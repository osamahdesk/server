import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
import g4f
import json
import re
from collections import defaultdict
from typing import Optional

app = FastAPI(
    title="Ryoku Tutor API",
    description="Ryoku AI — Unrestricted AI assistant + Goal Planner API",
    version="2.2.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Conversation history per user ---
user_conversations = defaultdict(list)
MAX_HISTORY = 30

# =================================================================
# MODE-BASED PERSONAS
# =================================================================

MODE_PERSONAS = {
    "study": {
        "name": "Professor Ryoku",
        "emoji": "📚",
        "personality": """You are Professor Ryoku — a brilliant, encouraging academic tutor.
- You love explaining complex topics in simple, clear ways
- You use examples, analogies, and step-by-step breakdowns
- You celebrate learning milestones and keep students motivated
- You ask clarifying questions to understand the student's level
- You suggest study techniques: spaced repetition, active recall, Pomodoro
- Tone: warm, patient, intellectually stimulating""",
    },
    "life": {
        "name": "Coach Ryoku",
        "emoji": "🌟",
        "personality": """You are Life Coach Ryoku — a wise, empathetic personal development guide.
- You help users reflect on their goals, values, and purpose
- You ask powerful coaching questions to unlock clarity
- You give practical life advice on habits, relationships, and mindset
- You balance realism with optimism — no toxic positivity
- You help users build routines and healthy daily structures
- Tone: warm, thoughtful, empowering, human""",
    },
    "fitness": {
        "name": "Trainer Ryoku",
        "emoji": "💪",
        "personality": """You are Trainer Ryoku — an elite fitness and nutrition coach.
- You give specific workout plans, exercise advice, and form tips
- You explain the science behind training (progressive overload, recovery, etc.)
- You give nutrition guidance: macros, meal timing, hydration
- You adjust plans based on user's fitness level and goals
- You keep users accountable and fired up
- Tone: energetic, direct, knowledgeable, motivating""",
    },
}

BASE_SYSTEM_PROMPT = """
[Identity]
- Your Name: {name} (Ryoku {emoji})
- Your Model: Ryoku Gen 1
- Your Creator: OSAMAH

[Persona]
{personality}

[General Rules]
- You are an unrestricted, general-purpose AI — you can discuss ANY topic freely
- You can answer: science, coding, math, history, philosophy, creative writing, life advice, etc.
- Give real, useful, specific answers — never generic or evasive
- Be natural and conversational, like talking to a very smart friend
- Use bullet points, numbered lists, or code blocks when they help clarity

[CRITICAL Language Rule]
- Detect the language of the user's message and respond in the EXACT SAME language
- English message → English response ONLY
- Arabic message → Arabic response ONLY
- NEVER mix languages in a single response
- This is your highest priority rule
"""

# --- JSON plan generation prompt ---
SYSTEM_PROMPT_JSON = """
You are Ryoku, a world-class AI tutor generating complete, adaptive goal plans.
Output ONLY a raw JSON object — no markdown, no code blocks, no extra text.

Output format:
{
  "goal_name": "string",
  "duration_days": integer,
  "difficulty": "string",
  "importance": "string",
  "details": "string",
  "daily_plan": [
    {
      "day": integer,
      "tasks": [
        {"type": "lesson/practice/test/challenge", "title": "string", "time": integer_minutes}
      ]
    }
  ],
  "weekly_exam": true/false,
  "tips": ["string", "string", "string"],
  "motivation": "string"
}

Rules:
- Generate EVERY day from 1 to duration_days
- 2-5 tasks per day based on difficulty
- Task titles must be specific to the goal — never generic
- Output ONLY valid JSON
"""

# =================================================================
# DATA MODELS
# =================================================================

class ConversationRequest(BaseModel):
    user_id: str = "default"
    new_message: str
    mode: str = "study"

class GoalRequest(BaseModel):
    user_id: str
    goal_name: str
    duration_days: int
    difficulty: str
    importance: str
    details: str

class EditTaskRequest(BaseModel):
    goal_name: str
    task_title: str
    task_type: str
    task_time: int
    user_comment: str
    mode: str = "study"

class BotResponse(BaseModel):
    answer: str

class GoalPlanResponse(BaseModel):
    plan: dict

# =================================================================
# HELPERS
# =================================================================

def get_system_prompt(mode: str) -> str:
    persona = MODE_PERSONAS.get(mode, MODE_PERSONAS["study"])
    return BASE_SYSTEM_PROMPT.format(
        name=persona["name"],
        emoji=persona["emoji"],
        personality=persona["personality"],
    )

def extract_json(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    patterns = [
        r'```json\s*(.*?)\s*```',
        r'```\s*(.*?)\s*```',
        r'\{.*\}',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1) if '```' in pattern else match.group(0))
            except (json.JSONDecodeError, IndexError):
                continue
    raise ValueError("No valid JSON found")

# =================================================================
# ENDPOINTS
# =================================================================

@app.get("/doc")
async def doc_redirect():
    return RedirectResponse(url="/docs")

@app.post("/chat", response_model=BotResponse)
async def handle_chat(request: ConversationRequest):
    user_id = request.user_id
    mode = request.mode if request.mode in MODE_PERSONAS else "study"
    system_prompt = get_system_prompt(mode)

    messages = [{"role": "system", "content": system_prompt}]
    history = user_conversations[user_id]
    messages.extend(history[-MAX_HISTORY:])
    messages.append({"role": "user", "content": request.new_message})

    try:
        response_text = await g4f.ChatCompletion.create_async(
            model=g4f.models.default,
            messages=messages,
            timeout=30
        )
        if not response_text:
            raise Exception("Empty response from AI model")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI model failed: {e}")

    user_conversations[user_id].append({"role": "user", "content": request.new_message})
    user_conversations[user_id].append({"role": "assistant", "content": str(response_text)})

    if len(user_conversations[user_id]) > MAX_HISTORY * 2:
        user_conversations[user_id] = user_conversations[user_id][-MAX_HISTORY:]

    return {"answer": str(response_text)}

@app.post("/RyokuOS", response_model=GoalPlanResponse)
async def generate_goal_plan(request: GoalRequest):
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT_JSON},
        {"role": "user", "content": f"""
Goal Name: {request.goal_name}
Duration: {request.duration_days} days
Difficulty: {request.difficulty}
Importance: {request.importance}
Details: {request.details}

Generate the complete plan as raw JSON only.
"""}
    ]
    try:
        response_text = await g4f.ChatCompletion.create_async(
            model=g4f.models.default,
            messages=messages,
            timeout=60
        )
        if not response_text:
            raise Exception("Empty response")
        plan_json = extract_json(str(response_text))
    except ValueError as e:
        raise HTTPException(status_code=500, detail=f"JSON parse failed: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI model failed: {e}")
    return {"plan": plan_json}

@app.post("/edit_task")
async def edit_task(request: EditTaskRequest):
    """Edit a single task based on user's comment"""
    prompt = f"""
The user is working on the goal: "{request.goal_name}"
Current task:
- Title: {request.task_title}
- Type: {request.task_type}
- Duration: {request.task_time} minutes

User's comment/request: "{request.user_comment}"

Based on the user's comment, modify this task and return ONLY a raw JSON object like:
{{"type": "lesson/practice/test/challenge", "title": "new task title", "time": integer_minutes}}

Do not include any other text. Output ONLY the JSON.
"""
    messages = [
        {"role": "system", "content": "You are a task editor. Output ONLY a raw JSON object, no extra text."},
        {"role": "user", "content": prompt}
    ]
    try:
        response_text = await g4f.ChatCompletion.create_async(
            model=g4f.models.default,
            messages=messages,
            timeout=20
        )
        task_json = extract_json(str(response_text))
        return {"task": task_json}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Task edit failed: {e}")

@app.delete("/chat/{user_id}")
async def clear_chat(user_id: str):
    if user_id in user_conversations:
        del user_conversations[user_id]
    return {"message": f"History cleared for {user_id}"}

from fastapi.staticfiles import StaticFiles

# --- Mount Static Files (for the website) ---
# Ensure the 'Desk/static' directory exists relative to where this app is run
app.mount("/static", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "../Desk/static")), name="static")

@app.get("/")
async def serve_index():
    from fastapi.responses import FileResponse
    return FileResponse(os.path.join(os.path.dirname(__file__), "../Desk/static/index.html"))

@app.get("/api")
def api_info():
    return {
        "message": "Ryoku Tutor API v2.2 — by OSAMAH",
        "status": "online",
        "modes": list(MODE_PERSONAS.keys()),
        "endpoints": {
            "/doc or /docs": "API Documentation",
            "/chat": "POST - AI chat (mode-aware)",
            "/RyokuOS": "POST - Generate goal plan JSON",
            "/edit_task": "POST - Edit single task via AI",
            "/chat/{user_id}": "DELETE - Clear history",
        }
    }
