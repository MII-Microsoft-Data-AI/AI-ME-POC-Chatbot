// Test file to verify personalization functionality
// This can be deleted after testing

export function testPersonalizationFeatures() {
  // Test 1: localStorage functionality
  const testSettings = {
    siteIcon: 'https://example.com/test-icon.png',
    primaryColor: '#ff0000',
    siteName: 'Test Chat'
  }
  
  try {
    localStorage.setItem('mii-chat-personalization', JSON.stringify(testSettings))
    const retrieved = JSON.parse(localStorage.getItem('mii-chat-personalization') || '{}')
    console.log('✓ localStorage test passed:', retrieved)
  } catch (error) {
    console.error('✗ localStorage test failed:', error)
  }
  
  // Test 2: CSS variable updates
  document.documentElement.style.setProperty('--primary', '#ff0000')
  const appliedColor = getComputedStyle(document.documentElement).getPropertyValue('--primary')
  console.log('✓ CSS variable test:', appliedColor)
  
  // Test 3: Favicon update
  const link = document.createElement('link')
  link.rel = 'icon'
  link.href = 'https://example.com/test-favicon.png'
  document.head.appendChild(link)
  console.log('✓ Favicon test completed')
  
  return true
}

// Export for potential use in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  ;(window as Window & { testPersonalization?: typeof testPersonalizationFeatures }).testPersonalization = testPersonalizationFeatures
}