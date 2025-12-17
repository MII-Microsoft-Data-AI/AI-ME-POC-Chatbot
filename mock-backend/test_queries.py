"""
Quick test untuk Azure Search tools dengan query yang relevan.
Run ini setelah backend restart untuk verify tools bekerja.
"""

# Test queries yang RELEVAN dengan konten index (produk kesehatan)
test_queries = [
    {
        "name": "Test 1: Panadol",
        "query": "Panadol untuk sakit kepala",
        "expected": "Harus return hasil tentang Panadol Extra"
    },
    {
        "name": "Test 2: Actifed",
        "query": "obat batuk dan pilek",
        "expected": "Harus return hasil tentang Actifed"
    },
    {
        "name": "Test 3: Sensodyne",
        "query": "pasta gigi sensitif",
        "expected": "Harus return hasil tentang Sensodyne"
    },
    {
        "name": "Test 4: Generic health",
        "query": "obat nyeri",
        "expected": "Harus return hasil tentang Panadol atau produk lain"
    }
]

print("=" * 80)
print("AZURE SEARCH TOOLS - TEST QUERIES")
print("=" * 80)
print("\nTest ini untuk memverifikasi bahwa tools bekerja dengan query yang RELEVAN")
print("dengan konten index (produk kesehatan Haleon).\n")

print("Cara test:")
print("1. Restart backend: Ctrl+C pada terminal backend, lalu run 'make dev-backend' lagi")
print("2. Buka frontend dan buat conversation baru")
print("3. Coba salah satu query di bawah:\n")

for i, test in enumerate(test_queries, 1):
    print(f"{i}. {test['name']}")
    print(f"   Query: \"{test['query']}\"")
    print(f"   Expected: {test['expected']}\n")

print("\n" + "=" * 80)
print("EXPECTED LOGS DI BACKEND")
print("=" * 80)
print("""
Jika tools bekerja dengan benar, kamu akan lihat log seperti ini:

🔍 Semantic search: query='Panadol untuk sakit kepala', top=5, config='my-semantic-config'
  📄 Result 1: score=0.8234
  📄 Result 2: score=0.7891
  ✅ Total results found: 2

Jika ada error, akan ada log detail dengan traceback.
""")

print("=" * 80)
print("TROUBLESHOOTING")
print("=" * 80)
print("""
Jika masih "No results found":
1. Cek semantic configuration name di Azure Portal
2. Update AZURE_SEARCH_SEMANTIC_CONFIG di .env jika perlu
3. Atau coba pakai tool 'azure_search_documents' (text search) instead

Jika error "semantic configuration not found":
1. Buka Azure Portal → Search Service → Index → Semantic configurations
2. Buat semantic configuration baru dengan nama 'my-semantic-config'
3. Atau update .env dengan nama config yang sudah ada
""")
