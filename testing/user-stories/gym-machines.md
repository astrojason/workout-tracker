# Gym Machines

## Managing machines

**As a user, in Settings → Equipment → Manage Gym Machines:**

- I can add a machine with a name and the weights its stack can be set to (e.g. `10, 20, 30, 42.5`); weights are sorted and de-duplicated
- A machine needs a name and at least two weights, and names are unique (case-insensitive); otherwise I see a clear message and nothing is saved
- I can edit a machine's name and weights
- I can delete a machine only after a confirmation that names it and says how many exercises use it
- While anything saves or deletes I see a busy state ("Saving…" / "Working…"), the list shows a spinner while loading, and every result is confirmed on screen; failures show the full error

## Linking exercises

**As a user creating or editing a machine exercise** (program editor for new exercises, Exercise Library for existing ones):

- If I have machines, a "Gym machine" picker appears when equipment is "Machine (weight stack)"
- Choosing a machine replaces the typed weights; the exercise's weight picker and "next weight step" progression use the machine's weights
- Choosing "None" keeps the weights I type for that exercise, exactly as before
- Editing a machine's weights updates every exercise linked to it
- Deleting a machine keeps each linked exercise working: it keeps the machine's weights on its own and is no longer linked
