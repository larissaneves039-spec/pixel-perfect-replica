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
- Audio analysis calls the Gemini API directly from the browser with the user's own key (stored in localStorage like the Pexels key): the app stays backend-free.
