"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { MOTION } from "@/components/providers/motion-provider";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

/**
 * Radix unmounts the menu the moment it closes, which would cut the exit
 * animation short. The root owns the open state and shares it so the content
 * can stay mounted under `AnimatePresence` until motion is finished.
 */
const OpenContext = React.createContext(false);

export function DropdownMenu({
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  const [open, setOpen] = React.useState(false);

  return (
    <OpenContext.Provider value={open}>
      <DropdownMenuPrimitive.Root open={open} onOpenChange={setOpen} {...props}>
        {children}
      </DropdownMenuPrimitive.Root>
    </OpenContext.Provider>
  );
}

export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

interface DropdownMenuContentProps {
  children: React.ReactNode;
  className?: string;
  align?: React.ComponentProps<typeof DropdownMenuPrimitive.Content>["align"];
  side?: React.ComponentProps<typeof DropdownMenuPrimitive.Content>["side"];
  sideOffset?: number;
}

export function DropdownMenuContent({
  children,
  className,
  align,
  side,
  sideOffset = 6,
}: DropdownMenuContentProps) {
  const open = React.useContext(OpenContext);

  return (
    <DropdownMenuPrimitive.Portal forceMount>
      <AnimatePresence>
        {open ? (
          <DropdownMenuPrimitive.Content
            asChild
            forceMount
            key="menu"
            align={align}
            side={side}
            sideOffset={sideOffset}
          >
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={MOTION.pop}
              className={cn(
                "z-100 min-w-[10rem] overflow-hidden rounded-md border border-border bg-surface-elevated p-1 text-foreground shadow-lg",
                className
              )}
            >
              {children}
            </motion.div>
          </DropdownMenuPrimitive.Content>
        ) : null}
      </AnimatePresence>
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        // The app ring is kept, pulled inside the item. A menu row's only other
        // focus mark is `surface-hover`, which is 1.15:1 against the menu — a
        // highlight, not an indicator. The inset is because the ring used to be
        // drawn 2px *outside* the row and clipped on the menu's own edge.
        "relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors focus:bg-surface-hover focus-visible:-outline-offset-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    />
  );
}

/**
 * Item that shows a check mark when selected. Selection is driven by the
 * caller, so this stays a plain Item rather than a Radix RadioItem.
 */
export function DropdownMenuSelectableItem({
  className,
  selected,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & { selected?: boolean }) {
  const mark = selected ? <Icon icon={Check} className="ml-auto" /> : null;

  /*
   * Under `asChild` the Radix Item slots itself onto `children`, which then
   * has to be a single element. Rendering the check mark as a sibling threw
   * "Primitive.div failed to slot onto its children" and dropped the mark, so
   * it is merged into the child element instead.
   */
  const content =
    props.asChild && React.isValidElement<{ children?: React.ReactNode }>(children) ? (
      React.cloneElement(
        children,
        undefined,
        <>
          {children.props.children}
          {mark}
        </>
      )
    ) : (
      <>
        {children}
        {mark}
      </>
    );

  return (
    <DropdownMenuItem className={cn("pr-8", selected && "text-accent-strong", className)} {...props}>
      {content}
    </DropdownMenuItem>
  );
}
