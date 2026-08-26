/*
|--------------------------------------------------------------------------
| Validator messages provider
|--------------------------------------------------------------------------
|
| VineJS's default `SimpleMessagesProvider` already produces correct,
| readable error messages for every validation rule. A previous custom
| `vine.messagesProvider` assignment here was a bare function, but VineJS
| calls `.getMessage(...)` on this value — a plain function has no such
| method, so it threw `TypeError: messagesProvider.getMessage is not a
| function` on every validation failure across the app.
|
| No custom messages are needed, so this file is intentionally a no-op.
| Kept as a preload target in case future customization is required.
|
*/
