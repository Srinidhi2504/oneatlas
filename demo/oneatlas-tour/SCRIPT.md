# OneAtlas walkthrough: voiceover script

Read this over `demo.mp4` (silent, rendered from `oneatlas-tour.yaml` with ndemo). Each section matches one video segment and starts at the time shown; the picture holds long enough for a relaxed pace (about 150 words a minute), so you will not be rushed. If you finish a section early, pause briefly; the next scene starts on its own.

**How to record:** open `demo.mp4` full screen, start Loom (or any recorder) with your microphone and screen, press play, and read. Total length is 8 minutes 18 seconds.

Words in *italics* are stage notes, not for reading.

---

## 0:00 Title card

*(Silent: "OneAtlas, every AI model, mapped." Take a breath.)*

## 0:04 · intro · Home page

Hi, I'm Srinidhi. This is OneAtlas, my project for the Full Stack Engineer take-home.

It's a discovery platform for AI models. You can search, filter, compare and rank more than seven hundred models from ninety-one labs, served by over three hundred API providers.

Everything you see comes from a Postgres database, through a typed REST API. Nothing is hardcoded in the frontend.

*(The cursor moves over the headline and the letters turn gold.)*

## 0:30 · stats · Catalog numbers

These numbers are live from the database: seven hundred and twenty-four models, ninety-one labs, three hundred and seven providers, and more than eight and a half thousand provider listings. The bars show how much of the catalog supports tool calling, reasoning, vision and open weights.

## 0:51 · search · Typo-tolerant search

Search is typo tolerant. I'll type "gpt4o", with no dash and no space, and GPT-4o still comes up.

That works because every model has a normalised search key, just letters and digits, backed by a Postgres trigram index. Partial and messy queries just work, without a separate search service.

## 1:12 · filters · Faceted filters

Filters are faceted. When I turn on tool calling and pick Anthropic, the counts next to every other option update, so you never click your way into an empty result.

All of this state lives in the URL. Any view can be shared as a link, and the back button works. Under the hood, the URL drives a TanStack Query key, and every change calls the models API.

## 1:43 · model-detail · A model page

Opening a model gives the full picture: context window, maximum output, reference price, a monthly cost calculator, capabilities, and benchmark scores with the model's rank among every scored model.

## 1:56 · detail-providers · Provider listings

Further down is every provider that serves this model, each at its own price. This is the core value of the product. The same model can cost very different amounts depending on where you call it.

## 2:13 · compare · Side-by-side comparison

To compare, I add this model, then jump to another one with the command palette, Control K, and add that too.

The compare page puts them side by side. The best value in every row is marked with a label, not only a colour, and there's a differences-only toggle and a share link.

## 2:36 · rankings · Leaderboards

Rankings has leaderboards for availability, intelligence, value, price, context window, and every individual benchmark. Ranks are recomputed for whatever filters you choose.

Best value divides the intelligence index by the blended price. This chart plots price against intelligence and traces the value frontier.

## 2:55 · benchmarks · Benchmark matrix

The benchmarks page lists all thirty benchmarks with their leaders, plus a score matrix where you pick the columns and the best score in each one is highlighted.

## 3:08 · directories · Labs and providers

Labs and providers each have a directory and their own pages, so you can start from a company or from an API instead of a model.

## 3:21 · code-viewer · The source, inside the product

Because I need to be able to explain every line, I made the source part of the product. The code page shows the whole repository exactly as deployed, in an editor-style viewer, with search, quick open, and links to any line. You can also download the complete project as a zip.

## 3:43 · arch-routes · Architecture: the API layer

Now the architecture. It's a single Next.js 16 application on Vercel, with PostgreSQL on Neon.

There are three layers. Route handlers, like this one for the models endpoint, are deliberately thin. They validate the query with Zod, call one service function, and shape the JSON response.

## 4:04 · arch-services · Architecture: the service layer

The service layer is the only code that touches the database, through Prisma 7.

Server-rendered pages call these same functions, so the first page you see and the API can never disagree. And the first page is rendered on the server with exactly the query the browser would send, so after the page loads there's no second request.

## 4:29 · caching · Caching

Every service read is cached with Next's "use cache" directive and tagged "catalog".

The data only changes when I re-run ingestion, so caching for hours is correct. After a re-seed, one protected endpoint expires the whole catalog at once. On a warm cache, the API answers in two to six milliseconds.

## 4:52 · pipeline · The data pipeline

The data comes from two public sources. The key decision was using models.dev as the spine, because it already maps more than eight thousand provider listings to canonical models, and using OpenRouter to add descriptions and benchmark scores.

Joining the two was the riskiest logic, so it's a small tested function: a lab alias map plus a slug normaliser. Two hundred and eighty-four of three hundred and fifty OpenRouter entries match, and the rest become models of their own.

## 5:25 · database · Database design

In the database, prices are exact decimals per million tokens, and capabilities are plain booleans, so filtering is cheap.

The columns the interface sorts by, like provider count, intelligence and value score, are precomputed during ingestion, each with a matching index. So every list and every leaderboard is a single indexed query. The seed is idempotent and reads snapshots committed to the repo, so it's fully reproducible.

## 5:54 · ask-the-code · Ask the code

There's also "Ask the code", an assistant that explains this codebase.

By default it plays prepared answers, so the demo costs nothing to run, and every answer cites real lines you can open. A live mode, where Claude reads the code through tools, is fully built and switches on with an API key.

## 6:18 · decisions · Technical decisions

A few decisions I'd defend.

Next.js route handlers instead of a separate NestJS service: one repository, one deploy, and the same Zod schemas and types shared by the API, the pages and the client.

Server rendering plus a visible API, so the first paint is fast and the integration is real.

And the URL as the single source of truth for filters, so everything is shareable.

## 6:46 · challenges · Challenges

Some challenges along the way.

Next 16's Cache Components changed the rules. Anything that reads the URL has to sit under Suspense, and errors thrown inside cached functions lose their type. At first that turned "not found" into server errors, so cached loaders now return null, and the caller maps that to a 404.

A generated database migration once tried to drop my trigram search index. I caught it in review and fixed it by hand.

And Lighthouse showed a three-second largest contentful paint, because my heading animation started invisible and the browser ignored it. Making the animation move without fading brought it under one second.

Every one of these is recorded in the decision log you're looking at.

## 7:36 · quality · Quality and security

On quality: seventy-six unit tests, Playwright end-to-end tests, Lighthouse above ninety for performance and a hundred for accessibility, security headers on every response, and no secrets anywhere in the browser bundle.

The site works in light and dark mode, and from phone width up to wide monitors.

## 7:57 · outro · Next steps

If this grew a hundred times, I'd move to keyset pagination, compute rankings in SQL or in materialised views, and put a dedicated search service and an edge rate limiter in front. The system design document in the repo covers that plan in detail.

Thanks for watching.
