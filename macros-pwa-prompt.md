# Macronutrient Tracking PWA - Original Prompt

Make a macronutrient tracking PWA which can be served as a TWA Android app. I'm doing a hypertrophy program and use MyFitnessPal, but I want to cancel that $20 per month subscription to save money and instead use my own app. I weigh 155lbs and shoot for 340g of carbs per day, 150g of protein per day, and 70g of fat per day at most. I am 5'11". I'll serve the app at https://macros.stephens.page.

## Follow-up Requirements

- Already have a Google Play developer account (publish the Creighton app there)
- Calorie tracking in addition to macros
- Cross-device sync (backend with database)
- Weight tracking over time
- Tracking by meal (breakfast/lunch/dinner/snacks) to know if I ate enough that meal to stay on track
- Recipe saving (e.g., "my green smoothie")
- Barcode scanning for packaged foods
- Combo food data source: Open Food Facts API + USDA FoodData Central API + custom/manual entry

## Auth & Infrastructure

- Email/password authentication with password reset
- SMTP via Mandrill (same creds as Creighton app)
- DNS record added for macros.stephens.page
