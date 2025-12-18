import AuthLayout from "@/components/AuthLayout"
import SettingsSidebar from "./SettingsSidebar"

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthLayout>
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-6xl mx-auto px-6 py-8 md:py-12">
          
          {/* Page Header */}
          <h1 className="text-3xl font-serif text-[#333] mb-12 font-medium tracking-tight">
            Settings
          </h1>

          <div className="flex flex-col md:flex-row gap-12">
            
            {/* Sidebar Navigation */}
            <SettingsSidebar />

            {/* Main Content Area */}
            <main className="flex-1 max-w-3xl">
              {children}
            </main>
          </div>
        </div>
      </div>
    </AuthLayout>
  )
}