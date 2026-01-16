# You can find the parsing on
# node_modules/assistant-stream/src/core/serialization/data-stream/chunk-types.ts

import json
import re
import uuid
import typing

from typing import List
from langgraph.graph.state import CompiledStateGraph
from langchain_core.messages import AIMessageChunk, AIMessage, ToolMessage, HumanMessage


DEBUG_STREAM = True

# Regex to match <reasoning>...</reasoning> tags (including multiline content)
REASONING_PATTERN = re.compile(r'<reasoning>(.*?)</reasoning>', re.DOTALL)


def handle_tool_message(msg: ToolMessage):
    """
    Handle ToolMessage - processes tool results and yields ToolCallResult (a:) chunks
    """
    tool_call_id = msg.tool_call_id
    print(f"  🛠️ Received tool result for {tool_call_id}")
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
        error_payload = json.dumps({'toolCallId': tool_call_id, 'isError': True, 'result': f'Error: {str(tool_error)}'})
        yield f"a:{error_payload}\n"


def handle_ai_message(msg: typing.Union[AIMessage, AIMessageChunk], tool_calls_by_idx: dict, tool_calls: dict, accumulated_text: str, token_count: int):
    """
    Handle AIMessage/AIMessageChunk - processes text content, reasoning, and tool calls
    Returns tuple of (accumulated_text, token_count)
    """
    # Handle text content - parse out reasoning tags and send appropriately
    if msg.content:
        content = str(msg.content)
        
        # Find all reasoning blocks and their positions
        last_end = 0
        for match in REASONING_PATTERN.finditer(content):
            # Send any text before this reasoning block as TextDelta (0:)
            text_before = content[last_end:match.start()]
            if text_before:
                yield f"0:{json.dumps(text_before)}\n"
                accumulated_text += text_before
                token_count += len(text_before.split())
            
            # Send the reasoning content as ReasoningDelta (g:)
            reasoning_content = match.group(1)
            if reasoning_content:
                yield f"g:{json.dumps(reasoning_content)}\n"
            
            last_end = match.end()
        
        # Send any remaining text after the last reasoning block as TextDelta (0:)
        remaining_text = content[last_end:]
        if remaining_text:
            yield f"0:{json.dumps(remaining_text)}\n"
            accumulated_text += remaining_text
            token_count += len(remaining_text.split())

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
            chunk_id = chunk.get("id")  # ID is only present on the FIRST chunk of a new tool call
            
            # If this chunk has an ID, it's the start of a NEW tool call - update the index mapping
            if chunk_id:
                tool_calls_by_idx[chunk_index] = chunk_id
                if chunk_id not in tool_calls:
                    tool_calls[chunk_id] = {"name": tool_name or "", "args": ""}
                print(f"  📤 New tool call detected at index {chunk_index}: {chunk_id}")
            
            tool_call_id = tool_calls_by_idx.get(chunk_index, -1)

            # Accumulate args and send ToolCallArgsTextDelta (c:)
            if tool_call_id != -1 and args_chunk:
                tool_calls[tool_call_id]["args"] += args_chunk
                yield f"c:{json.dumps({'toolCallId': tool_call_id, 'argsTextDelta': args_chunk})}\n"

async def generate_stream(graph: CompiledStateGraph, input_message: List[HumanMessage], conversation_id: str):
    # Generate unique message ID
    message_id = str(uuid.uuid4())
    
    try:
        # Send StartStep (f:) - Start of message processing
        chunk = f"f:{json.dumps({'messageId': message_id})}\n"
        if DEBUG_STREAM:
            print(f"  📤 SENDING CHUNK: {chunk.strip()}")
        yield chunk
    except (GeneratorExit, Exception) as e:
        print(f"Error sending start step: {e}")
        return
    
    tool_calls = {}
    tool_calls_by_idx = {}
    accumulated_text = ""
    token_count = 0
    
    if DEBUG_STREAM:
        stream_msg_count = 0
    try:
        for msg, metadata in graph.stream(
            {"messages": input_message},
            config={"configurable": {"thread_id": conversation_id}},
            stream_mode="messages",
        ):
            if DEBUG_STREAM:
                print(f"\n--- Streamed Message Chunk #{stream_msg_count} ---")
                print("type:", type(msg))
                print("msg:", msg)
                print("metadata:", metadata)
                stream_msg_count += 1
            try:
                if isinstance(msg, ToolMessage):
                    for chunk in handle_tool_message(msg):
                        if DEBUG_STREAM:
                            print(f"  📤 SENDING CHUNK: {chunk.strip()}")
                        yield chunk

                elif isinstance(msg, AIMessageChunk) or isinstance(msg, AIMessage):
                    for chunk in handle_ai_message(msg, tool_calls_by_idx, tool_calls, accumulated_text, token_count):
                        if isinstance(chunk, tuple):
                            accumulated_text, token_count = chunk
                        else:
                            if DEBUG_STREAM:
                                print(f"  📤 SENDING CHUNK: {chunk.strip()}")
                            yield chunk
            except GeneratorExit:
                # Client disconnected, stop processing
                return
            except Exception as yield_error:
                print(f"Error during message processing: {yield_error}")
                # Continue with next message instead of breaking completely
                continue
                        

        # Send FinishMessage (d:) with usage stats
        try:
            chunk = f"d:{json.dumps({'finishReason': 'stop', 'usage': {'promptTokens': token_count, 'completionTokens': token_count}})}\n"
            if DEBUG_STREAM:
                print(f"  📤 SENDING CHUNK: {chunk.strip()}")
            yield chunk
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
