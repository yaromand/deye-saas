export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-emerald-50 to-zinc-100 px-4 py-16">
      <div className="mb-8 text-center">
        <p className="text-2xl font-semibold tracking-tight text-emerald-900">
          Cloud Deye
        </p>
        <p className="mt-1 text-sm text-zinc-600">
          Мониторинг инверторов через облако вендора
        </p>
      </div>
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        {children}
      </div>
    </div>
  );
}
