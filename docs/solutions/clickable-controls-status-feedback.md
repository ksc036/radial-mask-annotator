# Clickable Controls Need Status Feedback

## Context

In the radial polygon app, core actions such as saving and point removal were hidden behind keyboard shortcuts or disabled buttons. That made the actions look broken even when the underlying handlers existed.

## Rule

For primary annotation workflows, expose visible buttons for core actions. If an action needs a precondition, keep the button clickable and show a concise status message explaining what is missing instead of silently disabling it.
