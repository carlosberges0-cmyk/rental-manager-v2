export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div style={{ colorScheme: "light" }}>
      {children}
    </div>
  )
}
