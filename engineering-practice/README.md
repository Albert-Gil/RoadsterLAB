# First Principles: open-answer engineering studio

Mobile-first English interview practice with 186 mixed open-answer problems: the original 150 fundamentals, 30 supplied SVG graphs/schematics, and 36 multi-part design cases. The original multiple-choice mode remains at `multiple-choice.html`, with its original progress key.

## Practice flow

1. Choose a mixed set or find a problem by ID/concept.
2. Enter numerical results with selected units and write assumptions, calculations, reasoning, design choices and validation.
3. Submit to check the stated numerical targets. Most quantities use 3% rounding tolerance; absolute temperatures use 0.25 K. Missing and invalid inputs are distinguished from incorrect values. This does not automatically grade the complete design.
4. Copy the prepared review prompt, open ChatGPT, paste and send. This is a separate ChatGPT conversation; no API key or automatic server-side AI is used.
5. Paste ChatGPT's JSON review back into the studio. It contains five rubric scores out of four, written feedback, corrections and a follow-up. The total is computed locally. The import checks problem identity and the current answer revision; editing clears stale feedback. A user-pasted review is not a verified API response.

Drafts, units, saved problems and imported reviews persist in browser-local storage. They do not synchronize across devices. Each response can be exported as plain text. Copying a prompt does not send it anywhere; the user submits it in ChatGPT.

## Source and publication

`questions.js`, `charts.js` and the legacy `engine.js`/`app.js` support the original mode. `open-bank.js` adapts the fundamentals, `advanced.js` supplies the 36 design cases, `open-engine.js` handles units/numerical checks/persistence/review validation, and `open-app.js`/`open-styles.css` provide the open-answer interface. `index.html` starts the open-answer mode.

The RoadsterLAB build copies the twelve browser files into `impulse/dist/engineering-practice/`; the vehicle application and quiz remain separate browser apps. No dependencies or API secrets are required.

From this directory run:

```sh
node --test tests.mjs open-tests.mjs open-ui-tests.mjs
```

The 101 checks cover original grading, charts and numerical keys; new open-response content; equivalent units and numeric parsing; independent energy/force/compatibility/economic balances; saved drafts; mixed-session sampling; and JSON review validation. Runtime smoke tests render every problem through a minimal DOM adapter and exercise input, submission and review import. They are not browser layout tests. Synthetic review fixtures test the import mechanism, not live ChatGPT correctness. Browser launch and loopback restrictions prevented visual QA in the authoring environment; physical mobile/Safari verification remains outstanding.

All scenarios are independent practice material, not official SpaceX questions or a disclosed plant design. Supplied material properties, COPs and component ratings are explicit toy-model assumptions. Alternative defensible engineering designs should be assessed on their actual assumptions and evidence, not by matching prose word for word.
