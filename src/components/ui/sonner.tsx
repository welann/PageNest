import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      duration={1000}
      position="bottom-right"
      richColors
      toastOptions={{
        classNames: {
          description: "text-muted-foreground",
          toast:
            "group toast group-[.toaster]:border-border group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:shadow-lg",
          title: "text-sm font-medium"
        }
      }}
      {...props}
    />
  );
}
