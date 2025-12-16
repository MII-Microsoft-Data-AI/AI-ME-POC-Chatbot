import AuthLayout from "@/components/AuthLayout"

export default function ImageGenerationLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AuthLayout>{children}</AuthLayout>
}
