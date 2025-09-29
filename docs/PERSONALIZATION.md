# Personalization Features

This application includes comprehensive personalization features that allow users to customize the appearance of their chat interface.

## Features

### 1. Site Name Customization
- Users can customize the site name displayed in the header and browser title
- Changes appear instantly throughout the application
- Affects navigation, page titles, and branding elements
- Real-time preview in the settings interface

### 2. Site Icon & Favicon Customization
- Users can set a custom site icon/logo by providing an image URL
- The same image is used for both the site logo and browser favicon
- Supports PNG, JPG, and SVG formats
- Real-time preview in the settings interface
- Automatic fallback to a default icon if the provided URL is invalid

### 3. Primary Color Theme
- Customizable primary color that affects buttons, highlights, and accent elements
- Color picker interface for precise color selection
- Pre-defined color presets for quick selection
- Real-time preview of color changes
- Hex color code input for advanced users

### 4. Persistent Settings
- All personalization settings are saved in localStorage
- Settings persist across browser sessions
- Automatic loading of saved settings on app startup
- Reset to defaults option available

## Implementation Details

### Components

#### `usePersonalization` Hook
Location: `src/hooks/usePersonalization.ts`
- Manages personalization state
- Handles localStorage persistence
- Applies CSS variables and favicon changes
- Provides reset functionality

#### `PersonalizationContext`
Location: `src/contexts/PersonalizationContext.tsx`
- React context for global state management
- Provides personalization data to all components

#### Settings Page
Location: `src/app/settings/page.tsx`
- User interface for customization
- Form controls for icon and color selection
- Real-time preview functionality
- Unsaved changes tracking

#### Logo Component
Location: `src/components/Logo.tsx`
- Uses personalized site icon
- Automatically updates when settings change

### Technical Implementation

#### CSS Variables
The application uses CSS custom properties to apply the primary color:
```css
:root {
  --primary: #00765a; /* Default value */
}
```

When a user changes the primary color, the `--primary` CSS variable is updated using:
```javascript
document.documentElement.style.setProperty('--primary', newColor)
```

#### Favicon Updates
Favicons are updated dynamically by:
1. Removing existing favicon links
2. Creating new `<link>` elements with the custom icon URL
3. Appending to the document head

#### localStorage Schema
Settings are stored in localStorage with the key `mii-chat-personalization`:
```json
{
  "siteName": "My Custom Chat",
  "siteIcon": "https://example.com/logo.png",
  "primaryColor": "#00765a"
}
```

## Usage

### For Users
1. Navigate to the Settings page
2. Use the "Personalization" section to:
   - Enter a custom site name
   - Enter a new site icon URL
   - Select or input a primary color
3. Preview changes in real-time
4. Click "Save Changes" to persist settings
5. Use "Reset to Default" to restore original settings

### For Developers

#### Using Personalized Settings
```tsx
import { usePersonalizationContext } from '@/contexts/PersonalizationContext'

function MyComponent() {
  const { settings } = usePersonalizationContext()
  
  return (
    <div style={{ color: settings.primaryColor }}>
      Custom colored text
    </div>
  )
}
```

#### Using Personalized Site Config
```tsx
import { getPersonalizedSiteConfig } from '@/lib/personalized-config'
import { usePersonalizationContext } from '@/contexts/PersonalizationContext'

function MyComponent() {
  const { settings } = usePersonalizationContext()
  const config = getPersonalizedSiteConfig(settings)
  
  return <img src={config.logo.src} alt={config.logo.alt} />
}
```

## Extending Personalization

To add new personalization options:

1. **Update the PersonalizationSettings interface**:
```typescript
export interface PersonalizationSettings {
  siteName: string
  siteIcon: string
  primaryColor: string
  // Add new setting here
  newSetting: string
}
```

2. **Update the default settings**:
```typescript
const DEFAULT_SETTINGS: PersonalizationSettings = {
  siteName: 'MII Chat',
  siteIcon: 'default-url',
  primaryColor: '#00765a',
  newSetting: 'default-value'
}
```

3. **Add form controls to the settings page**
4. **Update the `applySettings` function** if CSS changes are needed

## Browser Compatibility

- localStorage: All modern browsers
- CSS custom properties: IE 11+ (with polyfill if needed)
- Dynamic favicon updates: All modern browsers

## Security Considerations

- Image URLs are sanitized to prevent XSS
- Color values are validated to ensure proper hex format
- localStorage data is JSON parsed with error handling