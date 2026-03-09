import { createBrowserRouter } from "react-router-dom";

import { AppShell } from "@components/shell/AppShell";
import { HomePage } from "@features/home/HomePage";
import { ModulePage } from "@app/routes/ModulePage";

export const appRouter = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <HomePage />
      },
      {
        path: "m/:slug",
        element: <ModulePage />
      }
    ]
  }
]);

