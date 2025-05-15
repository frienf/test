calc-fe
calc-fe is a React-based front-end application for drawing mathematical expressions on a canvas, processing them via a backend API, and rendering the results as LaTeX using MathJax. It features a draggable and resizable canvas, color swatches, undo/redo functionality, a calculation history panel, and a responsive UI built with Tailwind CSS and Mantine components.
Features

Canvas Drawing: Draw mathematical expressions freehand with customizable colors.
Eraser Tool: Erase parts of the canvas by drawing over them with the eraser mode.
Canvas Manipulation: Drag (Shift + drag) and dynamically resize the canvas.
Calculation Processing: Send drawn expressions to a backend API for evaluation.
LaTeX Rendering: Display results as draggable LaTeX expressions using MathJax.
Calculation History: Persist and view past calculations, with the ability to revisit results.
Undo/Redo: Navigate through drawing history.
Responsive UI: Collapsible sidebar with controls and a floating "Run" button.
Keyboard Shortcuts: Toggle history panel with Ctrl+H.

Prerequisites

Node.js: Version 18 or higher.
npm: Version 8 or higher.
Backend API: A running instance of the calculation API (see Backend Requirements).

Setup

Clone the Repository:
git clone <repository-url>
cd frienf-math-notes-fe


Install Dependencies:
npm install


Configure Environment Variables:Create a .env file in the root directory and add the backend API URL:
VITE_API_URL=http://<your-backend-api-url>

Replace <your-backend-api-url> with the actual URL of your backend API.

Run the Development Server:
npm run dev

The app will be available at http://localhost:5173.


Scripts

npm run dev: Starts the development server with linting.
npm run build: Builds the app for production.
npm run lint: Runs ESLint to check code quality.
npm run preview: Previews the production build locally.

Usage

Drawing:

Click and drag on the canvas to draw mathematical expressions.
Use the sidebar to select colors from the swatch palette.
Toggle the eraser mode (eraser icon) to erase parts of the canvas by drawing over them.


Canvas Navigation:

Hold Shift and drag to move the canvas.
The canvas automatically extends when dragged beyond its boundaries.


Running Calculations:

Click the "Run" button (play icon) in the sidebar or floating button to process the drawn expression.
Results are rendered as LaTeX and can be dragged around the canvas.


History:

Toggle the history panel with Ctrl+H to view past calculations.
Click a calculation to re-display its LaTeX result.
Clear the history using the "Clear History" button.


Undo/Redo:

Use the undo/redo buttons in the sidebar to navigate drawing history.


Reset:

Click the reset button to clear the canvas and reset the app (preserves calculation history).



Backend Requirements
The app requires a backend API to process drawn expressions. The API should:

Accept POST requests at /calculate with a JSON body containing:
image: A base64-encoded PNG of the canvas.
dict_of_vars: An object of variable assignments.


Return a JSON response with an array of results, each containing:
expr: The evaluated expression.
result: The result of the expression.
assign: A boolean indicating if the result should be stored as a variable.



Example API endpoint:
POST http://<your-backend-api-url>/calculate

See the backend documentation for setup details (not included in this repository).
Project Structure
frienf-math-notes-fe/
├── public/                # Static assets
├── src/
│   ├── assets/           # Images and other assets
│   ├── components/       # Reusable UI components
│   ├── lib/              # Utility functions
│   ├── screens/          # Page-level components
│   ├── App.tsx           # Main app component with routing
│   ├── main.tsx          # Entry point
│   ├── index.css         # Tailwind CSS styles
│   └── constants.ts      # App constants (e.g., color swatches)
├── README.md             # Project documentation
├── package.json          # Dependencies and scripts
├── tailwind.config.js    # Tailwind CSS configuration
├── vite.config.ts        # Vite configuration
└── tsconfig*.json        # TypeScript configurations

Technologies

React: Front-end framework.
TypeScript: Static typing.
Vite: Build tool and development server.
Tailwind CSS: Utility-first CSS framework.
Mantine: UI component library.
MathJax: LaTeX rendering.
Axios: HTTP requests.
React Router: Routing.
Lucide React: Icons.
ESLint: Linting.

Contributing

Fork the repository.
Create a feature branch (git checkout -b feature/your-feature).
Commit changes (git commit -m "Add your feature").
Push to the branch (git push origin feature/your-feature).
Open a pull request.

License
This project is licensed under the MIT License.
Contact
For questions or feedback, please open an issue or contact the maintainers.
