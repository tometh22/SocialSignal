import { useId, useState, type ChangeEvent, type KeyboardEvent, type RefObject } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMaybeReviewRoom } from "@/hooks/use-review-room";

export function useStatusMentions(value: string, onChange: (value: string) => void, input: RefObject<HTMLTextAreaElement>) {
  const room = useMaybeReviewRoom()?.room;
  const { user } = useAuth();
  const menuId = useId();
  const [fragment, setFragment] = useState<{ start: number; end: number; query: string } | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [selected, setSelected] = useState<Record<number, string>>({});
  const options = fragment ? (room?.members ?? []).filter(member => member.userId !== user?.id).map(member => ({
    id: member.userId,
    name: [member.firstName, member.lastName].filter(Boolean).join(" ") || member.email || "Usuario",
    email: member.email,
  })).filter(member => `${member.name} ${member.email ?? ""}`.toLocaleLowerCase().includes(fragment.query)).slice(0, 8) : [];

  function onInput(event: ChangeEvent<HTMLTextAreaElement>) {
    const { value: text, selectionStart } = event.currentTarget;
    onChange(text);
    const match = /(?:^|\s)@([^\s@]*)$/.exec(text.slice(0, selectionStart));
    setFragment(match ? { start: selectionStart - match[1].length - 1, end: selectionStart, query: match[1].toLocaleLowerCase() } : null);
    setHighlight(0);
  }

  function select(index: number) {
    const option = options[index];
    if (!option || !fragment) return;
    const token = `@${option.name}`;
    onChange(value.slice(0, fragment.start) + token + " " + value.slice(fragment.end));
    setSelected(current => ({ ...current, [option.id]: token }));
    setFragment(null);
    const cursor = fragment.start + token.length + 1;
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(cursor, cursor);
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!options.length || event.nativeEvent.isComposing) return;
    if (event.key === "Escape") setFragment(null);
    else if (event.key === "Enter" || event.key === "Tab") select(highlight);
    else if (event.key === "ArrowDown") setHighlight(current => (current + 1) % options.length);
    else if (event.key === "ArrowUp") setHighlight(current => (current + options.length - 1) % options.length);
    else return;
    event.preventDefault();
  }

  const mentionIds = Object.entries(selected).filter(([, token]) => {
    const start = value.indexOf(token);
    return start !== -1 && !/[\p{L}\p{N}_]/u.test(value[start + token.length] ?? "");
  }).map(([id]) => Number(id));

  return {
    mentionIds,
    reset: () => { setSelected({}); setFragment(null); },
    inputProps: {
      onChange: onInput, onKeyDown, onBlur: () => setFragment(null),
      "aria-autocomplete": "list" as const,
      "aria-controls": options.length ? menuId : undefined,
      "aria-activedescendant": options.length ? `${menuId}-${highlight}` : undefined,
    },
    menu: options.length > 0 && (
      <ul id={menuId} role="listbox" aria-label="Miembros para mencionar" className="absolute left-0 top-full z-20 mt-1 max-h-52 w-72 max-w-full overflow-y-auto rounded-lg border bg-white py-1 shadow-lg">
        {options.map((option, index) => (
          <li key={option.id} id={`${menuId}-${index}`} role="option" aria-selected={index === highlight}
            className={`cursor-pointer px-3 py-1.5 text-sm ${index === highlight ? "bg-indigo-50" : ""}`}
            onMouseEnter={() => setHighlight(index)} onMouseDown={event => event.preventDefault()} onClick={() => select(index)}>
            <span className="block font-medium">{option.name}</span>
            {option.email && <span className="block truncate text-xs text-muted-foreground">{option.email}</span>}
          </li>
        ))}
      </ul>
    ),
  };
}
