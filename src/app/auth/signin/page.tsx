import SignInClient from "@/components/SignInClient"
import { getSafeCallbackUrl } from "@/lib/callback-utils"

interface SignInPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function SignIn({ searchParams }: SignInPageProps) {
  const params = await searchParams
  const next = getSafeCallbackUrl(params.next as string) || "/chat"

  return (
    <SignInClient 
      callbackUrl={next}
    />
  )
}
