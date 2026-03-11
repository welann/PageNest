import { RouterProvider } from "react-router-dom";

import { appRouter } from "@app/router";
import { Toaster } from "@components/ui/sonner";

export function App() {
  return (
    <>
      <RouterProvider router={appRouter} />
      <Toaster />
    </>
  );
}
