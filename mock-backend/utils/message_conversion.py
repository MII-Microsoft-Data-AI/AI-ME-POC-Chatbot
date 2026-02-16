from typing import Any

import urllib.parse

"""Helpers for converting Assistant UI content parts to LangGraph blocks."""

def decode_file_attachment(data_url: str) -> dict[str, Any]:
    """Decode base64 data URL to dictionary with mimetype, base64data, filename."""
    if not data_url.startswith("data:"):
        raise ValueError("Invalid data URL format")

    parts = data_url.split(",")
    if len(parts) < 2:
        raise ValueError("Invalid data URL format")

    header = parts[0]
    base64data = parts[1]

    # Parse mimetype from header
    if ":" not in header or ";" not in header.split(":", 1)[1]:
        raise ValueError("Invalid header format")
    mimetype = header.split(":", 1)[1].split(";", 1)[0]

    filename = None
    if len(parts) > 2:
        filename_part = parts[2]
        if filename_part.startswith("filename:"):
            encoded_filename = filename_part[9:]
            filename = urllib.parse.unquote(encoded_filename)

    return {"mimetype": mimetype, "base64data": base64data, "filename": filename}

def from_assistant_ui_contents_to_langgraph_contents(
    message: list[Any],
) -> list[dict[str, Any]]:
    """Convert Assistant UI content parts to LangGraph content blocks."""
    langgraph_contents: list[dict[str, Any]] = []

    for content in message:
        if content.get("type") == "text":
            langgraph_contents.append({
                "type": "text",
                "text": content.get("text", "")
            })
            continue

        if content.get("type") == "file":
            file_data = decode_file_attachment(content.get("data"))
            langgrapH_content = {
                "type": "file",
                "source_type": "base64",
                "filename": file_data["filename"],
                "mime_type": file_data["mimetype"],
                "data": file_data["base64data"]
            }
            langgraph_contents.append(langgrapH_content)
            continue

        if content.get("type") == "image":
            langgraph_content = {
                "type": "image_url",
                "image_url" : {
                    "url": content.get("image", "")
                }
            }
            langgraph_contents.append(langgraph_content)
            continue
    
    return langgraph_contents
