-- Run this in PocketBase admin to clear old tokens
DELETE FROM DeviceTokens WHERE platform = 'web';
