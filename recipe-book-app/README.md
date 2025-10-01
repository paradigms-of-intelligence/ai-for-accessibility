# Recipe Book App

A simple web application for browsing and managing recipes.

## Installation
Please replace 'YOUR_API_KEY_HERE' in main.js.
npm install
npm run build
npm run preview


## Functionality

*   **View Recipes**: Browse a list of pre-defined recipes.
*   **Search**: Filter recipes by title, ingredients, or keywords.
*   **View Details**: Click on a recipe to see its full ingredients and
    instructions.
*   **Favorites**: Mark recipes as favorites for quick access.
*   **UI Customization**:
    *   Toggle between light and dark mode.
    *   Increase or decrease the base font size.

## Adaptive Agent

This project includes an experimental "Adaptive Agent" that allows users to
interact with the application using voice commands.

### How it Works

The agent is built on top of the Gemini API and leverages the browser's built-in
Web Speech APIs for Speech-to-Text and Text-to-Speech. It's designed as a
self-contained module that can be integrated into a host application.

The core components are:

*   **`agent.ts`**: The main entry point for initializing, managing, and
    destroying the agent. It handles UI creation (buttons), event listeners, and
    orchestrates the different services.
*   **`gemini/geminiClient.ts`**: A client that manages all communication with
    the Gemini API, including sending user prompts, handling function-calling
    requests from the model, and emitting events.
*   **`config/`**: This directory defines the agent's capabilities.
    *   **`tools.ts`**: Declares the functions (tools) that the Gemini model can
        call. Each function corresponds to an action within the application,
        like `search_recipes` or `set_dark_mode`. This is where the agent is
        connected to the application's API.
    *   **`agentConfig.ts`** and **`systemInstructionsFactory.ts`**: These files
        build the system prompt for the model, telling it what its purpose is,
        what tools it has, and how it should behave.
*   **`services/`**: A bundle of reusable UI services that provide auditory and
    visual feedback.
    *   **`speechToTextService.ts`**: Manages microphone input and converts
        speech into text.
    *   **`textToSpeechService.ts`**: Converts the agent's text responses into
        speech.
    *   **`captionsService.ts`**: Displays temporary, draggable captions on the
        screen for user input and agent responses.
    *   **`earconService.ts`**: Plays short, non-speech audio cues (earcons) to
        provide feedback for events like enabling the agent, opening the mic, or
        encountering an error.

### Extending to Other Apps

The agent's architecture is designed to be portable. To adapt it to another
application, you would primarily need to:

1.  **Define New Tools**: Modify `config/tools.ts` to define functions that map
    to the target application's specific functionalities.
2.  **Update System Instructions**: Update `config/agentConfig.ts` with a new
    goal and task descriptions that match the new tools.
3.  **Integrate the Agent**: Call `initializeAgent` in the target application's
    main entry point, passing a CSS selector for where to place the agent's UI
    controls.

## ⚠️ Disclaimer


This application was "vibe coded" and is intended for **illustrative purposes
only**. 

This project is intended for demonstration purposes only. It is not
intended for use in a production environment.

The primary goal of this project is to serve as an inspiration and reference for
how a reusable bundle of accessibility-focused services (like captions, TTS,
STT, and earcons) can be combined to create a voice-driven adaptive agent. This
agent acts as a companion that understands how to use the application and can
expose its features and configuration settings through a natural language
interface, making the app more accessible and usable through voice interaction.
