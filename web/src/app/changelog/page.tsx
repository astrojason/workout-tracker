import { CHANGELOG } from "@/lib/changelog";

export default function ChangelogPage() {
  return (
    <main className="px-4 py-6 md:px-8 md:py-8 max-w-3xl mx-auto pb-32">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-zinc-100 mb-6">
        Changelog
      </h1>

      <div className="space-y-8">
        {CHANGELOG.map((entry) => (
          <section key={entry.version}>
            <div className="flex items-baseline gap-3 mb-2">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">
                v{entry.version}
              </h2>
              <span className="text-xs text-gray-400 dark:text-zinc-500">
                {entry.date}
              </span>
            </div>
            <ul className="list-disc list-outside pl-5 space-y-1">
              {entry.changes.map((change) => (
                <li
                  key={change}
                  className="text-sm text-gray-600 dark:text-zinc-300"
                >
                  {change}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
