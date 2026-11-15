from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.database.session import Base, engine
from app.api.routes import router
from app.services.ingest.pipeline import incident_hooks
from app.services.gemini.analyzer import gemini_hook
from app.services.discord.notifier import discord_hook
from app.services.alerts.channels import slack_hook, email_hook

Base.metadata.create_all(engine)

app = FastAPI(title="TokenShield API",
              description="Agent monitoring. All costs are ESTIMATES, not provider billing.")
app.add_middleware(CORSMiddleware,
                   allow_origins=[settings.frontend_origin, "http://localhost:3000"],
                   allow_methods=["*"], allow_headers=["*"])
incident_hooks.append(gemini_hook)
incident_hooks.append(discord_hook)
incident_hooks.append(slack_hook)
incident_hooks.append(email_hook)
app.include_router(router)