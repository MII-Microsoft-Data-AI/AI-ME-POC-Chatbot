import json
import uuid
from langchain_core.messages import AIMessageChunk, AIMessage, ToolMessage, HumanMessage

from langgraph.graph.state import CompiledStateGraph

from typing import List

async def generate_stream(graph: CompiledStateGraph, input_message: List[HumanMessage], conversation_id: str):
    # Generate unique message ID
    message_id = str(uuid.uuid4())
    
    try:
        # Send StartStep (f:) - Start of message processing
        yield f"f:{json.dumps({'messageId': message_id})}\n"
    except (GeneratorExit, Exception) as e:
        print(f"Error sending start step: {e}")
        return
    
    tool_calls = {}
    tool_calls_by_idx = {}
    accumulated_text = ""
    token_count = 0

    try:
        async for msg, metadata in graph.astream(
            {"messages": input_message},
            config={"configurable": {"thread_id": conversation_id}},
            stream_mode="messages",
        ):
            
            try:
                if isinstance(msg, ToolMessage):
                    # Handle tool results - ToolCallResult (a:)
                    tool_call_id = msg.tool_call_id
                    try:
                        # Ensure result is JSON serializable
                        result_content = msg.content
                        if isinstance(result_content, str) and len(result_content) > 10000:
                            # Truncate very long results to prevent stream issues
                            result_content = result_content[:10000] + "\n\n... (truncated)"
                            print(f"  ⚠️ Tool result truncated (original length: {len(msg.content)})")
                        
                        # Create the payload - json.dumps will handle all escaping
                        payload = {'toolCallId': tool_call_id, 'result': result_content}
                        payload_json = json.dumps(payload)
                        
                        print(f"  📤 Sending tool result for {tool_call_id}: {len(result_content)} chars")
                        yield f"a:{payload_json}\n"
                        
                    except Exception as tool_error:
                        print(f"  ❌ Error sending tool result: {tool_error}")
                        import traceback
                        traceback.print_exc()
                        # Send error message instead
                        error_payload = json.dumps({'toolCallId': tool_call_id, 'result': f'Error: {str(tool_error)}'})
                        yield f"a:{error_payload}\n"

                elif isinstance(msg, AIMessageChunk) or isinstance(msg, AIMessage):
                    # Handle text content - TextDelta (0:)
                    if msg.content:
                        # Send text delta - properly escape the content
                        content = str(msg.content)
                        yield f"0:{json.dumps(content)}\n"
                        accumulated_text += content
                        token_count += len(content.split())

                    # Handle tool calls
                    if hasattr(msg, 'tool_calls') and msg.tool_calls:
                        for tool_call in msg.tool_calls:
                            tool_call_id = tool_call.get('id', str(uuid.uuid4()))
                            tool_name = tool_call.get('name', '')

                            if tool_name == "":
                                continue

                            tool_calls_by_idx[len(tool_calls_by_idx)] = tool_call_id
                            tool_calls[tool_call_id] = {"name": tool_name, "args": ""}
                            
                            # Send StartToolCall (b:)
                            print(f"  📤 Sending tool call start: {tool_name} ({tool_call_id})")
                            yield f"b:{json.dumps({'toolCallId': tool_call_id, 'toolName': tool_name})}\n"
                            
                            # Send tool args immediately if available
                            tool_args = tool_call.get('args', {})
                            if tool_args:
                                # Convert args dict to JSON string for argsTextDelta
                                args_str = json.dumps(tool_args) if isinstance(tool_args, dict) else str(tool_args)
                                print(f"  📤 Sending tool args: {len(args_str)} chars")
                                yield f"c:{json.dumps({'toolCallId': tool_call_id, 'argsTextDelta': args_str})}\n"
                    
                    # Handle streaming tool call chunks
                    if hasattr(msg, 'tool_call_chunks') and msg.tool_call_chunks:
                        for chunk in msg.tool_call_chunks:
                            tool_name = chunk.get("name", "")
                            args_chunk = chunk.get("args", "")
                            chunk_index = chunk.get("index", 0)
                            tool_call_id = tool_calls_by_idx.get(chunk_index, -1)

                            # Accumulate args and send ToolCallArgsTextDelta (c:)
                            if tool_call_id != -1 and args_chunk:
                                tool_calls[tool_call_id]["args"] += args_chunk
                                yield f"c:{json.dumps({'toolCallId': tool_call_id, 'argsTextDelta': args_chunk})}\n"
            except GeneratorExit:
                # Client disconnected, stop processing
                return
            except Exception as yield_error:
                print(f"Error during message processing: {yield_error}")
                # Continue with next message instead of breaking completely
                continue
                        

        # Send FinishMessage (d:) with usage stats
        try:
            yield f"d:{json.dumps({'finishReason': 'stop', 'usage': {'promptTokens': token_count, 'completionTokens': token_count}})}\n"
        except (GeneratorExit, Exception) as e:
            print(f"Error sending finish message: {e}")
            return
        
    except Exception as e:
        print(f"Stream processing error: {e}")
        try:
            # Send Error (3:) with generic user-friendly message
            yield f"3:\"An error occurred, please try again.\"\n"
        except (GeneratorExit, Exception):
            # Stream already closed, just return
            return
