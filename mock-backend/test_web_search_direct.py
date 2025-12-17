"""
Direct test of web_search tool to verify it works.
"""
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set environment variable if not set
if not os.getenv("SEARXNG_URL"):
    os.environ["SEARXNG_URL"] = "https://searxng.kaenova.my.id"

from agent.tools import AVAILABLE_TOOLS

print("=" * 80)
print("DIRECT WEB_SEARCH TEST")
print("=" * 80)

# Find web_search tool
web_search_tool = None
for tool in AVAILABLE_TOOLS:
    if tool.name == "web_search":
        web_search_tool = tool
        break

if not web_search_tool:
    print("\n❌ web_search tool not found!")
    print(f"Available tools: {[t.name for t in AVAILABLE_TOOLS]}")
    sys.exit(1)

print(f"\n✅ Found web_search tool")
print(f"Description: {web_search_tool.description}")

# Test 1: Call with dict (how LangChain calls it)
print("\n" + "=" * 80)
print("TEST 1: Call with dict (LangChain style)")
print("=" * 80)

try:
    result = web_search_tool.invoke({"query": "Python programming language"})
    print(f"\n✅ Success!")
    print(f"\nResult (first 500 chars):")
    print(result[:500])
    print("...")
except Exception as e:
    print(f"\n❌ Failed: {str(e)}")
    import traceback
    traceback.print_exc()

# Test 2: Call with empty dict (simulating the bug)
print("\n" + "=" * 80)
print("TEST 2: Call with empty dict (simulating bug)")
print("=" * 80)

try:
    result = web_search_tool.invoke({})
    print(f"\n⚠️ Tool accepted empty dict!")
    print(f"Result: {result}")
except Exception as e:
    print(f"\n✅ Tool correctly rejected empty dict")
    print(f"Error: {str(e)}")

# Test 3: Call directly
print("\n" + "=" * 80)
print("TEST 3: Call function directly")
print("=" * 80)

try:
    result = web_search_tool.func("artificial intelligence")
    print(f"\n✅ Success!")
    print(f"\nResult (first 500 chars):")
    print(result[:500])
    print("...")
except Exception as e:
    print(f"\n❌ Failed: {str(e)}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 80)
print("TEST COMPLETE")
print("=" * 80)
