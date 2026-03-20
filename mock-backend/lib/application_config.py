"""Application configuration loader for APPLICATION_CONFIG_JSON_BASE64."""

from __future__ import annotations

import base64
import binascii
import json
import os
from typing import Any, Dict, Optional

from dotenv import load_dotenv

load_dotenv()

_APPLICATION_CONFIG_CACHE: Optional[Dict[str, Any]] = None
_MISSING = object()


def _require_raw_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise ValueError(f"Missing required environment variable: {name}")
    return value


def _get_config_value(config: Dict[str, Any], path: str) -> Any:
    current: Any = config
    for part in path.split("."):
        if not isinstance(current, dict) or part not in current:
            raise ValueError(f"Missing required config value: {path}")
        current = current[part]
    return current


def get_application_config_value(
    config: Dict[str, Any], path: str, default: Any = _MISSING
) -> Any:
    try:
        return _get_config_value(config, path)
    except ValueError:
        if default is _MISSING:
            raise
        return default


def get_required_application_config_value(config: Dict[str, Any], path: str) -> str:
    value = get_application_config_value(config, path)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"Config value {path} must be a non-empty string")
    return value.strip()


def get_int_application_config_value(
    config: Dict[str, Any], path: str, default: Any = _MISSING
) -> int:
    value = get_application_config_value(config, path, default)
    if isinstance(value, bool):
        raise ValueError(f"Config value {path} must be an integer")
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.strip().isdigit():
        return int(value.strip())
    if value is default and default is not _MISSING:
        return default
    raise ValueError(f"Config value {path} must be an integer")


def _validate_application_config(config: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(config, dict):
        raise ValueError("APPLICATION_CONFIG_JSON_BASE64 must decode to a JSON object")

    get_required_application_config_value(config, "server.host")
    port = get_int_application_config_value(config, "server.port")
    if port <= 0 or port > 65535:
        raise ValueError("Config value server.port must be between 1 and 65535")

    get_required_application_config_value(config, "auth.username")
    get_required_application_config_value(config, "auth.password")

    get_required_application_config_value(config, "cosmos.endpoint")
    get_required_application_config_value(config, "cosmos.key")
    get_required_application_config_value(config, "cosmos.database_name")

    return config


def get_application_config() -> Dict[str, Any]:
    global _APPLICATION_CONFIG_CACHE
    if _APPLICATION_CONFIG_CACHE is not None:
        return _APPLICATION_CONFIG_CACHE

    raw_config = _require_raw_env("APPLICATION_CONFIG_JSON_BASE64")
    try:
        decoded_config = base64.b64decode(raw_config, validate=True).decode("utf-8")
    except (binascii.Error, UnicodeDecodeError, ValueError) as exc:
        raise ValueError("Invalid base64 in APPLICATION_CONFIG_JSON_BASE64") from exc

    try:
        config = json.loads(decoded_config)
    except json.JSONDecodeError as exc:
        raise ValueError("Invalid JSON in APPLICATION_CONFIG_JSON_BASE64") from exc

    _APPLICATION_CONFIG_CACHE = _validate_application_config(config)
    return _APPLICATION_CONFIG_CACHE
