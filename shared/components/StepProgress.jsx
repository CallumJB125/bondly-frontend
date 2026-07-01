import React from 'react';
import './StepProgress.css';

/**
 * StepProgress — shared progress bar for multi-step application flows.
 *
 * Props:
 *   steps   — string[]  — ordered step labels
 *   current — number    — 1-indexed active step
 */
export default function StepProgress({ steps, current }) {
  return (
    <div className="apply-progress">
      {steps.map((label, i) => (
        <div
          key={label}
          className={`apply-progress__step ${current > i + 1 ? 'completed' : current === i + 1 ? 'active' : ''}`}
        >
          <div className="apply-progress__dot">{current > i + 1 ? '✓' : i + 1}</div>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
