<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- tsconfig noUncheckedIndexedAccess is off: index-heavy timeline/render code would need non-null asserts everywhere.
- Video download recovery uses a bounded replacement loader and video-only searches; recording waits for playable clips so blocked downloads cannot silently become still images.
- Audio analysis calls the Gemini API directly from the browser with the user's own key (stored in localStorage like the Pexels key); those keys are never sent to the backend.
- Auth email redirect URLs include Vite's deployment base path so confirmations return to the GitHub Pages app rather than the domain root; the same full URL must be allowed in Supabase Auth settings.
- The app is fully client-side and is deployed as a static SPA to GitHub Pages (`vite.pages.config.ts`, base path from `PAGES_BASE_PATH`, shell prerendered to `index.html`). Data goes straight from the browser to the user's external Supabase (tables `folders`/`videos`, private bucket `videos`) under RLS — do not reintroduce `createServerFn` or server routes under `src/routes/api/`; the guard test `src/test/no-server-dependency.test.ts` fails when they reappear. The GitHub Actions worker (`scripts/render-worker.ts`) claims/updates jobs directly with the service-role key and serves the static build via `scripts/serve-static.ts`.
