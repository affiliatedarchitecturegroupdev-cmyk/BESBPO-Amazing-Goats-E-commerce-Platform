# Cut-off cycle engine
Implemented in `services/commerce/src/cycles/cutoff.ts` (tested). Africa/Johannesburg is UTC+2 all year.

| Class | Public cut-off | Trade | Prepared | Delivered |
|---|---|---|---|---|
| Chilled meat, boxes | Sunday 17:00 | Locks Sunday 12:00, top-up until Monday 12:00 | Slaughter Monday 06:00, cut and pack Tuesday | Wednesday 06:00 to Friday 18:00 |
| Eggs, dairy, produce | 48 hours before route day | same | Packed the day before | Route days, early slots for bakeries |
| Ambient | 15:00 next working day | same | Same day | Courier or route |
| Live animals | Any time, 48 hours notice | | Health papers, weighing | Appointment |
| Seasonal | Hard date per event, deposit | | | |

Rules: dynamic early close when capacity is full; late orders roll to the next cycle and show the new date; edits free until cut-off; perishables cannot be cancelled afterwards; reminders 24 h and 4 h before; public holidays shift cycles. At cut-off the scheduler closes the cycle, creates purchase orders (abattoir, farms), pick lists and the route plan, then notifies customers.
