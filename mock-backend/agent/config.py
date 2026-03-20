"""Agent configuration loader for AGENT_CONFIG_JSON_BASE64."""

from __future__ import annotations

import base64
import binascii
import json
import os
from typing import Any, Dict, Optional

_AGENT_CONFIG_CACHE: Optional[Dict[str, Any]] = None
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


def get_config_value(config: Dict[str, Any], path: str, default: Any = _MISSING) -> Any:
    try:
        return _get_config_value(config, path)
    except ValueError:
        if default is _MISSING:
            raise
        return default


def get_required_config_value(config: Dict[str, Any], path: str) -> str:
    value = get_config_value(config, path)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"Config value {path} must be a non-empty string")
    return value.strip()


def get_bool_config_value(
    config: Dict[str, Any], path: str, default: bool = False
) -> bool:
    value = get_config_value(config, path, default)
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "y", "on"}:
            return True
        if normalized in {"false", "0", "no", "n", "off"}:
            return False
    if value is default:
        return default
    raise ValueError(f"Config value {path} must be a boolean")


def _normalize_openai_base_url(path: str, value: str) -> str:
    normalized = value.strip().rstrip("/")
    if not normalized.endswith("/v1"):
        raise ValueError(f"Config value {path} must end with /v1")
    return normalized


def _validate_openai_section(config: Dict[str, Any], path: str) -> None:
    _normalize_openai_base_url(
        f"{path}.base_url",
        get_required_config_value(config, f"{path}.base_url"),
    )
    get_required_config_value(config, f"{path}.api_key")
    get_required_config_value(config, f"{path}.model_id")


def _validate_agent_config(config: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(config, dict):
        raise ValueError("AGENT_CONFIG_JSON_BASE64 must decode to a JSON object")

    _validate_openai_section(config, "llm")

    if get_bool_config_value(config, "prompty.enabled", False):
        get_required_config_value(config, "prompty.base_url")
        get_required_config_value(config, "prompty.project_id")
        get_required_config_value(config, "prompty.api_key")

    if get_bool_config_value(config, "tools.searxng.enabled", False):
        get_required_config_value(config, "tools.searxng.base_url")

    if get_bool_config_value(config, "tools.azure_session_pool.enabled", False):
        get_required_config_value(config, "tools.azure_session_pool.endpoint")

    if get_bool_config_value(config, "tools.ai_search.enabled", False):
        get_required_config_value(config, "tools.ai_search.endpoint")
        get_required_config_value(config, "tools.ai_search.api_key")
        get_required_config_value(config, "tools.ai_search.index_name")
        if get_bool_config_value(
            config, "tools.ai_search.openai_embedding.enabled", False
        ):
            _validate_openai_section(config, "tools.ai_search.openai_embedding")

    if get_bool_config_value(config, "tools.generate_image.enabled", False):
        provider = get_required_config_value(
            config, "tools.generate_image.provider"
        ).lower()
        if provider not in {"dalle", "flux", "gpt_image"}:
            raise ValueError(
                "Config value tools.generate_image.provider must be one of: dalle, flux, gpt_image"
            )

        get_required_config_value(
            config, "tools.generate_image.storage.connection_string"
        )
        get_required_config_value(config, "tools.generate_image.storage.container_name")

        if provider == "dalle":
            _validate_openai_section(config, "tools.generate_image.dalle")
        elif provider == "flux":
            get_required_config_value(config, "tools.generate_image.flux.endpoint")
            get_required_config_value(config, "tools.generate_image.flux.api_key")
            get_required_config_value(config, "tools.generate_image.flux.model_id")
        elif provider == "gpt_image":
            get_required_config_value(config, "tools.generate_image.gpt_image.endpoint")
            get_required_config_value(config, "tools.generate_image.gpt_image.api_key")
            get_required_config_value(config, "tools.generate_image.gpt_image.model_id")

    return config


def get_agent_config() -> Dict[str, Any]:
    global _AGENT_CONFIG_CACHE
    if _AGENT_CONFIG_CACHE is not None:
        return _AGENT_CONFIG_CACHE

    raw_config = _require_raw_env("AGENT_CONFIG_JSON_BASE64")
    try:
        decoded_config = base64.b64decode(raw_config, validate=True).decode("utf-8")
    except (binascii.Error, UnicodeDecodeError, ValueError) as exc:
        raise ValueError("Invalid base64 in AGENT_CONFIG_JSON_BASE64") from exc

    try:
        config = json.loads(decoded_config)
    except json.JSONDecodeError as exc:
        raise ValueError("Invalid JSON in AGENT_CONFIG_JSON_BASE64") from exc

    _AGENT_CONFIG_CACHE = _validate_agent_config(config)
    return _AGENT_CONFIG_CACHE
