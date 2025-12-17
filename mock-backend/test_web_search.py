"""
Test script untuk verify web_search tool.
"""
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

print("=" * 80)
print("WEB SEARCH TOOL - DIAGNOSTIC")
print("=" * 80)

# Check environment variable
searxng_url = os.getenv("SEARXNG_URL")
print(f"\n1. Environment Variable Check:")
if searxng_url:
    print(f"   ✅ SEARXNG_URL: {searxng_url}")
else:
    print(f"   ❌ SEARXNG_URL: NOT SET")
    sys.exit(1)

# Test SearxNG connection directly
print(f"\n2. Testing SearxNG Connection:")
try:
    import requests
    response = requests.get(f"{searxng_url}/search?q=test&format=json", timeout=5)
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ SearxNG is accessible")
        print(f"   ✅ Test query returned {len(data.get('results', []))} results")
    else:
        print(f"   ❌ SearxNG returned status code: {response.status_code}")
except Exception as e:
    print(f"   ❌ Failed to connect to SearxNG: {str(e)}")
    sys.exit(1)

# Check if tool is loaded
print(f"\n3. Checking if web_search tool is loaded:")
try:
    from agent.tools import AVAILABLE_TOOLS
    
    tool_names = [tool.name for tool in AVAILABLE_TOOLS]
    print(f"   Total tools loaded: {len(tool_names)}")
    print(f"   Tools: {tool_names}")
    
    if 'web_search' in tool_names:
        print(f"   ✅ web_search tool is loaded!")
        
        # Test the tool
        print(f"\n4. Testing web_search tool:")
        web_search_tool = next(tool for tool in AVAILABLE_TOOLS if tool.name == 'web_search')
        
        try:
            result = web_search_tool.invoke({"query": "Python programming"})
            print(f"   ✅ Tool executed successfully")
            print(f"\n   Result preview (first 200 chars):")
            print(f"   {result[:200]}...")
        except Exception as e:
            print(f"   ❌ Tool execution failed: {str(e)}")
            import traceback
            traceback.print_exc()
    else:
        print(f"   ❌ web_search tool is NOT loaded!")
        print(f"\n   Possible reasons:")
        print(f"   - SEARXNG_URL not set when tools.py was imported")
        print(f"   - Error during tool initialization")
        print(f"   - Backend needs to be restarted")
        
except Exception as e:
    print(f"   ❌ Error checking tools: {str(e)}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 80)
print("DIAGNOSTIC COMPLETE")
print("=" * 80)
