/** Shown while a screen loads its data on the server. */
export default function AppLoading() {
  return (
    <div role="status" aria-label="Cargando" className="flex flex-col gap-4">
      <div className="h-40 animate-pulse rounded-card bg-track" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-24 animate-pulse rounded-card bg-track" />
        <div className="h-24 animate-pulse rounded-card bg-track" />
      </div>
      <div className="h-64 animate-pulse rounded-card bg-track" />
    </div>
  );
}
