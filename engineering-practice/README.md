# First Principles: engineering interview practice

Buildless mobile quiz with 150 mixed engineering questions, four choices per question, immediate explanations, and 30 SVG graphs or schematics. Questions and answer positions are shuffled. Standard mixed sets include structural and thermal-cycle questions. Progress, saved questions and the active session use browser-local storage.

Source files are in this directory: questions.js, engine.js, charts.js, app.js, styles.css and index.html. No dependencies or build step are needed for the quiz. From this directory run `node --test tests.mjs` for 76 content, numerical, chart and session checks. QA diagrams are generated in qa/.

The RoadsterLAB build copies only the six browser files into its output at `engineering-practice/`, giving the quiz its own URL. The vehicle application and quiz run independently. The information dialog links primary technical references; all scenarios are independent practice material rather than official SpaceX interview questions or a confirmed process design.

Verification: automated content checks, independent numerical checks, grading/persistence checks and SVG checks passed. Physical mobile-browser layout has not been visually verified. Progress stays in this browser and does not synchronize across devices.
