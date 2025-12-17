# Azure Search Tools - Troubleshooting Guide

## Masalah yang Ditemukan

### 1. **"No semantic results found" Error**

#### Penyebab

Dari log dan investigasi, ada beberapa kemungkinan penyebab:

1. **Query tidak relevan dengan konten index**
   - Query: `"latest trends in web development 2025"`
   - Index berisi: Dokumen tentang produk kesehatan (Actifed, Panadol, Sensodyne)
   - ✅ **Ini normal** - tidak ada hasil karena query tidak match

2. **Semantic configuration tidak ada atau salah nama**
   - Default config: `my-semantic-config`
   - Perlu dicek di Azure Portal apakah config ini exist

3. **Field mapping tidak sesuai**
   - ❌ Code mencari field `title` yang tidak ada di index
   - ✅ Index hanya punya: `id`, `content`, `file_id`, `filename`, `userid`, `chunk_index`

## Solusi yang Sudah Diterapkan

### 1. **Fixed Field Mapping**

Updated semua tools untuk tidak menggunakan field `title` yang tidak exist:

```python
# Before (ERROR)
formatted_result = {
    "title": result.get("title", "No title"),  # ❌ Field tidak ada
    "content": result.get("content", "No content"),
}

# After (FIXED)
formatted_result = {
    "content": result.get("content", "No content"),  # ✅ Field yang ada
    "metadata": {k: v for k, v in result.items() if not k.startswith("@") and k not in ["content"]}
}
```

### 2. **Added Better Logging**

Sekarang tools akan print detail di console:

```
🔍 Semantic search: query='test', top=5, config='my-semantic-config'
  📄 Result 1: score=0.5494585
  📄 Result 2: score=0.548632
  ✅ Total results found: 2
```

### 3. **Improved Error Messages**

Error messages sekarang lebih informatif:

```
No semantic results found for query: 'xxx'

ℹ️ Possible reasons:
- Semantic configuration 'my-semantic-config' doesn't exist in index
- Query doesn't match any documents
- Try using regular text search instead
```

### 4. **Environment Variable Support**

Semantic config dan vector field sekarang bisa dikonfigurasi via environment variables:

```bash
# .env
AZURE_SEARCH_SEMANTIC_CONFIG=my-semantic-config  # Default jika tidak diset
AZURE_SEARCH_VECTOR_FIELD=content_vector  # Default jika tidak diset
```

## Cara Mengecek Semantic Configuration

### Option 1: Via Azure Portal

1. Buka Azure Portal → Your Search Service
2. Pilih index `poc-chatbot`
3. Klik tab **"Semantic configurations"**
4. Cek apakah ada configuration dengan nama `my-semantic-config`
5. Jika tidak ada, buat configuration baru atau update environment variable

### Option 2: Via REST API

```bash
curl -X GET \
  "https://ai-ml-aisearch.search.windows.net/indexes/poc-chatbot?api-version=2023-11-01" \
  -H "api-key: YOUR_API_KEY"
```

Cari section `semanticSearch.configurations[]` di response.

## Testing Tools

### Test dengan Query yang Relevan

Karena index berisi dokumen tentang produk kesehatan, coba query yang relevan:

```python
# ✅ GOOD - Relevan dengan konten
azure_search_semantic(query="Panadol untuk sakit kepala", top=3)
azure_search_semantic(query="obat batuk Actifed", top=3)
azure_search_semantic(query="pasta gigi sensitif", top=3)

# ❌ BAD - Tidak relevan
azure_search_semantic(query="web development trends", top=3)
azure_search_semantic(query="machine learning", top=3)
```

### Test dengan Filter

Filter berdasarkan user atau file:

```python
# Filter by user
azure_search_filter(
    query="Panadol",
    filter_expression="userid eq 'mock-user-1'",
    top=5
)

# Filter by filename
azure_search_filter(
    query="*",
    filter_expression="filename eq 'Konten Tambahan Arjuna.pdf'",
    top=10
)
```

## Monitoring

Sekarang setiap kali tools dipanggil, akan ada log di console backend:

```
🔍 Semantic search: query='Panadol', top=5, config='my-semantic-config'
  📄 Result 1: score=0.8234
  📄 Result 2: score=0.7891
  ✅ Total results found: 2
```

Jika ada error, akan print full traceback:

```
❌ Error performing semantic search: The index does not have a semantic configuration with the name 'my-semantic-config'
Traceback (most recent call last):
  ...
```

## Next Steps

1. **Cek Semantic Configuration**
   - Buka Azure Portal
   - Lihat tab "Semantic configurations" di index
   - Catat nama configuration yang ada
   - Update `.env` jika perlu:

     ```bash
     AZURE_SEARCH_SEMANTIC_CONFIG=nama-config-yang-benar
     ```

2. **Test dengan Query Relevan**
   - Coba query yang match dengan konten (produk kesehatan)
   - Lihat log di backend untuk detail

3. **Setup Vector Search (Optional)**
   - Jika ingin pakai vector search, pastikan:
     - Documents punya field `content_vector` dengan embeddings
     - Environment variables Azure OpenAI sudah diset
     - Embedding model deployment sudah ada

## Environment Variables Checklist

```bash
# Required untuk semua Azure Search tools
✅ AZURE_SEARCH_ENDPOINT=https://ai-ml-aisearch.search.windows.net
✅ AZURE_SEARCH_API_KEY=your-api-key
✅ AZURE_SEARCH_INDEX_NAME=poc-chatbot

# Optional untuk semantic search
⚠️ AZURE_SEARCH_SEMANTIC_CONFIG=my-semantic-config  # Cek nama yang benar!

# Required untuk vector search
⚠️ AZURE_OPENAI_ENDPOINT=https://your-openai.openai.azure.com
⚠️ AZURE_OPENAI_API_KEY=your-openai-key
⚠️ AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME=text-embedding-ada-002

# Optional untuk vector search
⚠️ AZURE_SEARCH_VECTOR_FIELD=content_vector  # Default
```

## Summary

✅ **Fixed Issues:**

- Removed dependency on non-existent `title` field
- Added comprehensive logging
- Improved error messages
- Added environment variable support

⚠️ **Action Required:**

- Verify semantic configuration name in Azure Portal
- Update `AZURE_SEARCH_SEMANTIC_CONFIG` if needed
- Test with relevant queries (health products, not web dev)

🎯 **Expected Behavior:**

- Tools should now work correctly with the existing index schema
- Better error messages when things go wrong
- Detailed logs for debugging
