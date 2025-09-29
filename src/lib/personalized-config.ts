import { getSiteConfig } from '@/lib/site-config'
import { PersonalizationSettings } from '@/hooks/usePersonalization'

export function getPersonalizedSiteConfig(personalization?: PersonalizationSettings) {
  const config = getSiteConfig()
  
  if (!personalization) return config
  
  return {
    ...config,
    name: personalization.siteName,
    title: `${personalization.siteName} - Your AI Assistant`,
    favicon: personalization.siteIcon,
    logo: {
      ...config.logo,
      src: personalization.siteIcon,
      alt: `${personalization.siteName} Logo`
    }
  }
}