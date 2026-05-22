// src/components/molecules/QuestionTemplateModal.tsx
import React, { useState } from "react";
import { Modal } from "./Modal";
import { Button } from "../atoms/Button";
import { QUESTION_TEMPLATES, type QuestionTemplate } from "../../utils/formFieldTemplates";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (selected: QuestionTemplate[]) => void;
  isLoading?: boolean;
}

export function QuestionTemplateModal({ isOpen, onClose, onAdd, isLoading }: Props) {
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const allSelected = checked.size === QUESTION_TEMPLATES.length;

  function toggleAll() {
    if (allSelected) {
      setChecked(new Set());
    } else {
      setChecked(new Set(QUESTION_TEMPLATES.map((_, i) => i)));
    }
  }

  function toggle(index: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  }

  function handleAdd() {
    const selected = QUESTION_TEMPLATES.filter((_, i) => checked.has(i));
    onAdd(selected);
    setChecked(new Set());
  }

  function handleClose() {
    setChecked(new Set());
    onClose();
  }

  return (
    <Modal isOpen={isOpen} title="Add from Template" onClose={handleClose}>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Select the questions you'd like to add to your RSVP form.
      </p>

      {/* Select All */}
      <label className="flex items-center gap-3 mb-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={toggleAll}
          className="h-4 w-4 rounded border-gray-300 text-primary accent-primary"
        />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Select all
        </span>
      </label>

      <div className="divide-y divide-gray-100 dark:divide-white/10 border border-gray-100 dark:border-white/10 rounded-lg overflow-hidden mb-5">
        {QUESTION_TEMPLATES.map((tpl, i) => (
          <label
            key={i}
            className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            <input
              type="checkbox"
              checked={checked.has(i)}
              onChange={() => toggle(i)}
              className="h-4 w-4 rounded border-gray-300 text-primary accent-primary flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{tpl.label}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{tpl.text}</p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary flex-shrink-0">
              {tpl.typeKey}
            </span>
            {tpl.isRequired && (
              <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300 flex-shrink-0">
                Required
              </span>
            )}
          </label>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={handleClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          onClick={handleAdd}
          disabled={checked.size === 0 || isLoading}
        >
          {isLoading ? "Adding..." : `Add ${checked.size > 0 ? checked.size : ""} Question${checked.size !== 1 ? "s" : ""}`}
        </Button>
      </div>
    </Modal>
  );
}
