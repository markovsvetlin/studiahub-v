import { WebSite, Organization, SoftwareApplication, WithContext } from 'schema-dts'

interface StructuredDataProps {
  type: 'website' | 'organization' | 'software'
}

export default function StructuredData({ type }: StructuredDataProps) {
  const getStructuredData = (): WithContext<WebSite | Organization | SoftwareApplication> => {
    const baseUrl = 'https://studiahub.io'
    
    switch (type) {
      case 'organization':
        return {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'StudiaHub',
          url: baseUrl,
          logo: `${baseUrl}/logo4.png`,
          description: 'AI-powered learning platform that transforms study materials into personalized quizzes',
          sameAs: [
            'https://instagram.com/studiahub',
            'https://tiktok.com/@studiahub'
          ],
          contactPoint: {
            '@type': 'ContactPoint',
            email: 'hello@studiahub.com',
            contactType: 'Customer Service'
          }
        }

      case 'software':
        return {
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'StudiaHub',
          applicationCategory: 'EducationalApplication',
          operatingSystem: 'Web Browser',
          description: 'Transform your study materials into personalized AI quizzes. Upload PDFs, documents, or images and accelerate your learning with intelligent, adaptive quizzes.',
          url: baseUrl,
          creator: {
            '@type': 'Organization',
            name: 'StudiaHub'
          },
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock'
          },
          featureList: [
            'AI Quiz Generation',
            'PDF Processing',
            'Adaptive Learning',
            'Progress Tracking',
            'Multi-format Support'
          ],
          screenshot: `${baseUrl}/logo4.png`
        }

      case 'website':
      default:
        return {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'StudiaHub',
          url: baseUrl,
          description: 'AI-powered learning platform that transforms study materials into personalized quizzes',
          publisher: {
            '@type': 'Organization',
            name: 'StudiaHub',
            logo: {
              '@type': 'ImageObject',
              url: `${baseUrl}/logo4.png`
            }
          }
        }
    }
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(getStructuredData())
      }}
    />
  )
}
