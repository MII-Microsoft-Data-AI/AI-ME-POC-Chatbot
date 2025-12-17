"""
Print tool schemas yang di-generate oleh LangChain.
Ini untuk debug kenapa LLM tidak memanggil tool dengan parameter yang benar.
"""
import os
import sys
import json

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent.tools import AVAILABLE_TOOLS

print("=" * 80)
print("TOOL SCHEMAS")
print("=" * 80)

for tool in AVAILABLE_TOOLS:
    print(f"\n{'='*80}")
    print(f"Tool: {tool.name}")
    print(f"{'='*80}")
    print(f"\nDescription: {tool.description}")
    
    # Get the schema
    if hasattr(tool, 'args_schema'):
        schema = tool.args_schema
        if schema:
            print(f"\nArgs Schema:")
            if hasattr(schema, 'schema'):
                print(json.dumps(schema.schema(), indent=2))
            else:
                print(f"  {schema}")
    
    # Try to get the function signature
    if hasattr(tool, 'func'):
        import inspect
        sig = inspect.signature(tool.func)
        print(f"\nFunction Signature: {sig}")
        
        # Get parameter details
        print(f"\nParameters:")
        for param_name, param in sig.parameters.items():
            annotation = param.annotation if param.annotation != inspect.Parameter.empty else "Any"
            default = param.default if param.default != inspect.Parameter.empty else "REQUIRED"
            print(f"  - {param_name}: {annotation} = {default}")

print("\n" + "=" * 80)
print("SUMMARY")
print("=" * 80)
print(f"\nTotal tools: {len(AVAILABLE_TOOLS)}")
print(f"Tool names: {[tool.name for tool in AVAILABLE_TOOLS]}")

# Check if web_search is present
web_search_tools = [tool for tool in AVAILABLE_TOOLS if tool.name == 'web_search']
if web_search_tools:
    print(f"\n✅ web_search tool is present")
    web_search = web_search_tools[0]
    print(f"   Description: {web_search.description}")
else:
    print(f"\n❌ web_search tool is NOT present")
    print(f"   Check SEARXNG_URL environment variable")
