# app.py — Run with: streamlit run app.py
# Deployed at: https://phishscan-ai-4mpcusz7thepqtvh73nkqh.streamlit.app

from PIL import Image
import easyocr
import io
import os
import json
import base64
import streamlit as st
import streamlit.components.v1 as components
import torch
import numpy as np
import Levenshtein
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from lime.lime_text import LimeTextExplainer

# ── Page Config ──
st.set_page_config(
    page_title="PhishScan AI — Email Threat Detector",
    page_icon="🛡️",
    layout="centered"
)

# ── IRS URL ───────────────────────────────────────────────────────────────────
IRS_BASE_URL = "https://yashveer483.github.io/Incident-Reporting/index.html"
# ─────────────────────────────────────────────────────────────────────────────

# ══════════════════════════════════════════════════════════
#  CUSTOM CSS
# ══════════════════════════════════════════════════════════
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Syne:wght@700;800&display=swap');

/* ── Design Tokens ── */
:root {
  --bg-main:        #0B0F1A;
  --bg-card:        #1E293B;
  --bg-input:       #131B2E;
  --bg-deep:        #0D1120;
  --text-primary:   #E5E7EB;
  --text-secondary: #9CA3AF;
  --text-muted:     #4B5563;
  --gradient-main:  linear-gradient(90deg, #7C3AED, #EC4899, #22D3EE);
  --gradient-btn:   linear-gradient(135deg, #7C3AED 0%, #EC4899 60%, #22D3EE 100%);
  --gradient-hero:  linear-gradient(135deg, #A78BFA 0%, #F472B6 50%, #67E8F9 100%);
  --accent-purple:  #7C3AED;
  --accent-pink:    #EC4899;
  --accent-cyan:    #22D3EE;
  --danger:         #EF4444;
  --danger-bg:      rgba(239,68,68,0.1);
  --danger-border:  rgba(239,68,68,0.35);
  --warning:        #F59E0B;
  --warning-bg:     rgba(245,158,11,0.1);
  --warning-border: rgba(245,158,11,0.35);
  --success:        #10B981;
  --success-bg:     rgba(16,185,129,0.1);
  --success-border: rgba(16,185,129,0.35);
  --glow-purple:    rgba(124,58,237,0.35);
  --glow-pink:      rgba(236,72,153,0.35);
  --glow-cyan:      rgba(34,211,238,0.35);
  --border-subtle:  rgba(255,255,255,0.07);
  --border-card:    rgba(255,255,255,0.1);
  --radius-card:    14px;
  --radius-btn:     10px;
  --radius-input:   8px;
}

/* ══════════════════════════════════════
   HIDE STREAMLIT DEFAULT UI ELEMENTS
══════════════════════════════════════ */

/* Hide the entire top header bar (contains Deploy button) */
header[data-testid="stHeader"] {
  display: none !important;
  height: 0 !important;
  visibility: hidden !important;
}

/* Hide Deploy button and toolbar specifically */
.stDeployButton,
[data-testid="stDeployButton"],
[data-testid="stToolbar"],
[data-testid="stDecoration"],
.stToolbar,
#MainMenu,
footer,
footer a,
[data-testid="stStatusWidget"] {
  display: none !important;
  visibility: hidden !important;
}

/* Remove the top white gap left by hidden header */
.appview-container .main .block-container {
  margin-top: 0 !important;
}

/* ── Base ── */
html, body, [class*="css"], * {
  font-family: 'Space Grotesk', sans-serif !important;
}

.stApp {
  background: var(--bg-main) !important;
  margin-top: 0 !important;
}

.main {
  background: var(--bg-main) !important;
}

.block-container {
  padding-top: 1.5rem !important;
  padding-bottom: 3rem !important;
  max-width: 880px !important;
  margin: 0 auto !important;
}

/* Grid texture */
.stApp::before {
  content: "";
  position: fixed; inset: 0;
  background-image:
    linear-gradient(rgba(124,58,237,0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(124,58,237,0.025) 1px, transparent 1px);
  background-size: 44px 44px;
  pointer-events: none;
  z-index: 0;
}

/* ══════════════════════════════════════
   HERO
══════════════════════════════════════ */
.hero-wrap {
  width: 100%;
  text-align: center;
  padding: 2.5rem 1.5rem 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hero-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(124,58,237,0.12);
  border: 1px solid rgba(124,58,237,0.4);
  border-radius: 100px;
  padding: 5px 18px;
  font-family: 'JetBrains Mono', monospace !important;
  font-size: 11px;
  letter-spacing: 2.5px;
  color: #C4B5FD;
  text-transform: uppercase;
  margin-bottom: 1.4rem;
}

.hero-eyebrow::before {
  content: "";
  width: 7px; height: 7px;
  background: var(--accent-cyan);
  border-radius: 50%;
  animation: pulse-dot 2s ease-in-out infinite;
  flex-shrink: 0;
}

@keyframes pulse-dot {
  0%,100% { opacity:1; box-shadow: 0 0 0 0 var(--glow-cyan); }
  50%      { opacity:.6; box-shadow: 0 0 0 5px rgba(34,211,238,0); }
}

.hero-title {
  font-family: 'Syne', sans-serif !important;
  font-size: 3.6rem;
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -1px;
  margin: 0 0 0.8rem 0;
  background: var(--gradient-hero);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  width: 100%;
  text-align: center;
}

/* ── Subtitle: fully centered, no wrapping issues ── */
.hero-subtitle {
  font-size: 1.05rem;
  color: var(--text-secondary);
  font-weight: 400;
  line-height: 1.7;
  text-align: center;
  margin: 0 auto 2rem auto;
  width: 100%;
  max-width: 600px;
  padding: 0 1rem;
  display: block;
}

.hero-subtitle strong {
  color: var(--text-primary);
  font-weight: 600;
}

.stats-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  width: 100%;
}

.stat-pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: rgba(30,41,59,0.85);
  border: 1px solid var(--border-card);
  border-radius: 100px;
  padding: 8px 20px;
}

.stat-val {
  font-family: 'JetBrains Mono', monospace !important;
  font-size: 1rem;
  font-weight: 600;
  color: #C4B5FD;
}

.stat-lbl {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
  letter-spacing: 0.4px;
}

.grad-line {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(124,58,237,.5), rgba(236,72,153,.5), rgba(34,211,238,.5), transparent);
  border: none;
  margin: 2rem 0;
}

/* ══════════════════════════════════════
   TABS
══════════════════════════════════════ */
.stTabs [data-baseweb="tab-list"] {
  background: rgba(30,41,59,0.6) !important;
  border: 1px solid var(--border-card) !important;
  border-radius: var(--radius-card) var(--radius-card) 0 0 !important;
  gap: 0 !important;
  padding: 5px !important;
  margin-bottom: 0 !important;
}

.stTabs [data-baseweb="tab"] {
  background: transparent !important;
  color: var(--text-secondary) !important;
  border: none !important;
  border-radius: 10px !important;
  font-family: 'Space Grotesk', sans-serif !important;
  font-weight: 600 !important;
  font-size: 0.9rem !important;
  letter-spacing: 0.3px !important;
  padding: 0.55rem 1.5rem !important;
  transition: all 0.2s ease !important;
}

.stTabs [data-baseweb="tab"]:hover {
  background: rgba(124,58,237,0.1) !important;
  color: #C4B5FD !important;
}

.stTabs [aria-selected="true"] {
  background: linear-gradient(135deg, rgba(124,58,237,0.25), rgba(236,72,153,0.15)) !important;
  color: #E9D5FF !important;
  box-shadow: inset 0 0 0 1px rgba(124,58,237,0.45) !important;
}

.stTabs [data-baseweb="tab-panel"] {
  padding: 0 !important;
  background: rgba(20,27,46,0.6);
  border: 1px solid var(--border-card);
  border-top: none;
  border-radius: 0 0 var(--radius-card) var(--radius-card);
}

/* ── Input Card ── */
.input-card {
  padding: 1.8rem 2rem 2rem;
}

.card-label {
  font-family: 'JetBrains Mono', monospace !important;
  font-size: 10px;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 1.2rem;
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-label::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--border-subtle);
}

/* ── Input Fields ── */
.stTextArea > label,
.stTextInput > label {
  font-family: 'JetBrains Mono', monospace !important;
  font-size: 11px !important;
  font-weight: 500 !important;
  letter-spacing: 2px !important;
  text-transform: uppercase !important;
  color: var(--text-secondary) !important;
  margin-bottom: 6px !important;
}

.stTextArea textarea {
  background: var(--bg-input) !important;
  color: var(--text-primary) !important;
  border: 1px solid rgba(255,255,255,0.1) !important;
  border-radius: var(--radius-input) !important;
  font-family: 'Space Grotesk', sans-serif !important;
  font-size: 0.9rem !important;
  font-weight: 400 !important;
  line-height: 1.65 !important;
  caret-color: var(--accent-cyan) !important;
  transition: border-color .2s, box-shadow .2s !important;
  resize: vertical !important;
}

.stTextArea textarea:focus {
  border-color: rgba(124,58,237,0.65) !important;
  box-shadow: 0 0 0 3px rgba(124,58,237,0.12), 0 0 20px rgba(124,58,237,0.06) !important;
}

.stTextArea textarea::placeholder {
  color: var(--text-muted) !important;
  font-style: italic !important;
}

.stTextInput input {
  background: var(--bg-input) !important;
  color: var(--text-primary) !important;
  border: 1px solid rgba(255,255,255,0.1) !important;
  border-radius: var(--radius-input) !important;
  font-family: 'JetBrains Mono', monospace !important;
  font-size: 0.85rem !important;
  caret-color: var(--accent-cyan) !important;
  transition: border-color .2s, box-shadow .2s !important;
}

.stTextInput input:focus {
  border-color: rgba(124,58,237,0.65) !important;
  box-shadow: 0 0 0 3px rgba(124,58,237,0.12) !important;
}

.stTextInput input::placeholder { color: var(--text-muted) !important; }

/* ── Buttons ── */
.stButton > button {
  font-family: 'Space Grotesk', sans-serif !important;
  font-weight: 700 !important;
  font-size: 0.9rem !important;
  letter-spacing: 0.8px !important;
  border-radius: var(--radius-btn) !important;
  transition: all 0.25s ease !important;
  border: none !important;
}

.stButton > button[kind="primary"] {
  background: var(--gradient-btn) !important;
  color: #ffffff !important;
  padding: 0.7rem 1.2rem !important;
  box-shadow: 0 0 22px var(--glow-purple), 0 4px 16px rgba(0,0,0,0.4) !important;
}

.stButton > button[kind="primary"]:hover {
  filter: brightness(1.12) !important;
  box-shadow: 0 0 34px var(--glow-purple), 0 0 14px var(--glow-pink), 0 6px 20px rgba(0,0,0,0.5) !important;
  transform: translateY(-2px) !important;
}

.stButton > button[kind="primary"]:active {
  transform: translateY(0) !important;
  filter: brightness(0.95) !important;
}

.stButton > button[kind="secondary"] {
  background: rgba(30,41,59,0.9) !important;
  border: 1px solid rgba(255,255,255,0.12) !important;
  color: var(--text-secondary) !important;
  padding: 0.65rem 1rem !important;
}

.stButton > button[kind="secondary"]:hover {
  border-color: rgba(124,58,237,0.55) !important;
  color: #C4B5FD !important;
  background: rgba(124,58,237,0.1) !important;
  box-shadow: 0 0 12px rgba(124,58,237,0.15) !important;
}

.stLinkButton a {
  font-family: 'Space Grotesk', sans-serif !important;
  font-weight: 700 !important;
  font-size: 0.9rem !important;
  background: linear-gradient(135deg, #b91c1c, var(--danger), #F87171) !important;
  border: none !important;
  border-radius: var(--radius-btn) !important;
  color: #ffffff !important;
  box-shadow: 0 0 22px rgba(239,68,68,0.35), 0 4px 14px rgba(0,0,0,0.4) !important;
  transition: all 0.25s ease !important;
}

.stLinkButton a:hover {
  filter: brightness(1.1) !important;
  box-shadow: 0 0 32px rgba(239,68,68,0.5) !important;
  transform: translateY(-1px) !important;
}

/* ── Results Wrapper ── */
.results-wrap {
  margin-top: 1.5rem;
  background: rgba(20,27,46,0.85);
  border: 1px solid var(--border-card);
  border-radius: var(--radius-card);
  overflow: hidden;
}

.results-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1.5rem;
  border-bottom: 1px solid var(--border-subtle);
  background: rgba(11,15,26,0.6);
}

.results-header-title {
  font-family: 'JetBrains Mono', monospace !important;
  font-size: 11px;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--text-muted);
}

.results-header-badge {
  font-family: 'JetBrains Mono', monospace !important;
  font-size: 10px;
  letter-spacing: 2px;
  padding: 3px 10px;
  border-radius: 100px;
  background: rgba(124,58,237,0.18);
  border: 1px solid rgba(124,58,237,0.35);
  color: #C4B5FD;
}

.results-body { padding: 1.5rem; }

/* ── Score Display ── */
.score-display {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 1.2rem;
  position: relative;
  overflow: hidden;
}

.score-circle {
  flex-shrink: 0;
  width: 100px; height: 100px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 3px solid;
  background: rgba(0,0,0,0.3);
  position: relative;
  z-index: 1;
}

.score-num {
  font-family: 'Syne', sans-serif !important;
  font-size: 2.4rem;
  font-weight: 800;
  line-height: 1;
}

.score-of {
  font-family: 'JetBrains Mono', monospace !important;
  font-size: 9px;
  color: var(--text-muted);
  letter-spacing: 1px;
  margin-top: 1px;
}

.score-meta {
  flex: 1;
  position: relative;
  z-index: 1;
}

.score-verdict {
  font-family: 'Syne', sans-serif !important;
  font-size: 1.2rem;
  font-weight: 700;
  margin-bottom: 0.35rem;
  letter-spacing: 0.5px;
}

.score-confidence {
  font-family: 'JetBrains Mono', monospace !important;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 0.8rem;
}

.score-confidence span {
  color: var(--text-primary);
  font-weight: 600;
}

.progress-track {
  height: 6px;
  background: rgba(255,255,255,0.06);
  border-radius: 10px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 10px;
  background: linear-gradient(90deg, #7C3AED, #EC4899, #22D3EE);
  box-shadow: 0 0 8px var(--glow-purple);
}

/* ── Reason Items ── */
.reasons-title {
  font-family: 'JetBrains Mono', monospace !important;
  font-size: 10px;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  gap: 8px;
}

.reasons-title::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--border-subtle);
}

.reason-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: rgba(11,15,26,0.7);
  border: 1px solid var(--danger-border);
  border-left: 3px solid var(--danger);
  border-radius: 0 8px 8px 0;
  padding: 11px 14px;
  margin-bottom: 8px;
  font-family: 'Space Grotesk', sans-serif !important;
  font-size: 0.875rem;
  font-weight: 400;
  color: var(--text-primary);
  line-height: 1.5;
}

.reason-item::before {
  content: "▸";
  color: var(--danger);
  font-size: 0.85rem;
  flex-shrink: 0;
  margin-top: 1px;
}

.reason-item.safe {
  border-color: var(--success-border);
  border-left-color: var(--success);
}

.reason-item.safe::before { color: var(--success); }

/* ── Alert overrides ── */
[data-testid="stNotificationContentError"],
[data-testid="stNotificationContentError"] * { color: #FCA5A5 !important; }

[data-testid="stNotificationContentWarning"],
[data-testid="stNotificationContentWarning"] * { color: #FCD34D !important; }

[data-testid="stNotificationContentSuccess"],
[data-testid="stNotificationContentSuccess"] * { color: #6EE7B7 !important; }

[data-testid="stNotificationContentInfo"],
[data-testid="stNotificationContentInfo"] * { color: #93C5FD !important; }

div[data-testid="stAlert"] {
  border-radius: 10px !important;
  font-family: 'Space Grotesk', sans-serif !important;
}

/* ── OCR Box ── */
.ocr-box {
  background: var(--bg-deep);
  border: 1px solid rgba(34,211,238,0.18);
  border-radius: 8px;
  padding: 1rem 1.2rem;
  font-family: 'JetBrains Mono', monospace !important;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.8;
  max-height: 160px;
  overflow-y: auto;
  margin: 0.8rem 0;
}

.ocr-box::-webkit-scrollbar { width: 4px; }
.ocr-box::-webkit-scrollbar-track { background: transparent; }
.ocr-box::-webkit-scrollbar-thumb { background: rgba(34,211,238,0.2); border-radius: 2px; }

/* ── File Uploader ── */
[data-testid="stFileUploader"] {
  background: var(--bg-input) !important;
  border: 1px dashed rgba(124,58,237,0.35) !important;
  border-radius: var(--radius-card) !important;
  transition: border-color 0.2s !important;
}

[data-testid="stFileUploader"]:hover {
  border-color: rgba(124,58,237,0.65) !important;
}

/* ── Upload Hint ── */
.upload-hint {
  font-family: 'JetBrains Mono', monospace !important;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 2.1;
  margin-bottom: 1rem;
}

.upload-hint span {
  color: #C4B5FD;
  font-weight: 500;
}

/* ── Caption ── */
.stCaption, [data-testid="stCaptionContainer"] {
  color: var(--text-muted) !important;
  font-family: 'JetBrains Mono', monospace !important;
  font-size: 11px !important;
}

/* ── Spinner ── */
.stSpinner > div { border-top-color: var(--accent-purple) !important; }

/* ── Image ── */
.stImage img {
  border-radius: 10px !important;
  border: 1px solid var(--border-card) !important;
}

/* ── Footer ── */
.footer-wrap {
  text-align: center;
  padding: 2.5rem 0 1rem;
}

.footer-inner {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-family: 'JetBrains Mono', monospace !important;
  font-size: 11px;
  letter-spacing: 1.5px;
  color: var(--text-muted);
}

.footer-dot {
  width: 3px; height: 3px;
  border-radius: 50%;
  background: var(--text-muted);
  opacity: 0.35;
}

.footer-brand {
  background: var(--gradient-main);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 600;
}

/* ── Scrollbar ── */
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: var(--bg-main); }
::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.25); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(124,58,237,0.45); }

hr {
  border: none !important;
  border-top: 1px solid var(--border-subtle) !important;
  margin: 1rem 0 !important;
}
</style>
""", unsafe_allow_html=True)

# ── Load BERT Model ──
@st.cache_resource
def load_model():
    model_path = "Yashveer30989/phishscan-model"
    tok = AutoTokenizer.from_pretrained(model_path)
    mdl = AutoModelForSequenceClassification.from_pretrained(model_path)
    mdl.eval()
    return tok, mdl

# ── Load OCR Model ──
@st.cache_resource
def load_ocr():
    reader = easyocr.Reader(['en'], gpu=False)
    return reader

tokenizer, model = load_model()
explainer = LimeTextExplainer(class_names=["Safe", "Phishing"])
ocr_reader = load_ocr()

# ═══════════════════════════════
#  BACKEND — unchanged
# ═══════════════════════════════
def predict_proba(texts):
    inputs = tokenizer(texts, return_tensors="pt",
                       truncation=True, padding=True, max_length=256)
    with torch.no_grad():
        logits = model(**inputs).logits
    return torch.softmax(logits, dim=1).numpy()

URGENCY   = ['immediately','action required','suspended','verify',
             'unauthorized','urgent','account locked','expire','click here']
FINANCIAL = ['wire transfer','payment','bank account',
             'invoice','inheritance','beneficiary']
BRANDS    = ['paypal.com','microsoft.com','google.com',
             'amazon.com','apple.com','netflix.com']

def rule_engine(text, sender=""):
    reasons, score = [], 0
    t = text.lower()
    found_u = [w for w in URGENCY if w in t]
    if found_u:
        reasons.append(f"Urgency triggers detected: {', '.join(found_u)}")
        score += 30
    found_f = [w for w in FINANCIAL if w in t]
    if found_f:
        reasons.append(f"Financial lure keywords: {', '.join(found_f)}")
        score += 25
    if sender and "@" in sender:
        domain = sender.split('@')[-1].lower()
        for brand in BRANDS:
            dist = Levenshtein.distance(domain, brand)
            if 0 < dist <= 2:
                reasons.append(f"Lookalike domain '{domain}' mimics '{brand}'")
                score += 40
    if ("http" in t or "www" in t) and ("click" in t or "login" in t):
        reasons.append("Suspicious call-to-action link detected")
        score += 20
    return min(score, 100), reasons

def phishscan_predict(email_text, sender_email=""):
    rule_score, rule_reasons = rule_engine(email_text, sender_email)
    probs = predict_proba([email_text[:512]])[0]
    bert_prob = float(probs[1])
    exp = explainer.explain_instance(
        email_text[:400], predict_proba, num_features=5, num_samples=50)
    lime_reasons = [
        f"Suspicious word: '{w}' (confidence boost: {wt:.3f})"
        for w, wt in exp.as_list() if wt > 0.005
    ]
    final_score = min(int(bert_prob * 60) + min(rule_score, 40), 100)
    if final_score >= 70:
        verdict = "HIGH RISK — LIKELY PHISHING"
        color   = "#EF4444"
        glow    = "rgba(239,68,68,0.35)"
    elif final_score >= 40:
        verdict = "MEDIUM RISK — SUSPICIOUS"
        color   = "#F59E0B"
        glow    = "rgba(245,158,11,0.35)"
    else:
        verdict = "LOW RISK — LIKELY SAFE"
        color   = "#10B981"
        glow    = "rgba(16,185,129,0.35)"
    return {
        "score": final_score, "verdict": verdict,
        "color": color, "glow": glow,
        "confidence": round(bert_prob * 100, 1),
        "reasons": (rule_reasons + lime_reasons) or ["No specific threat indicators found."]
    }

# ── Build IRS URL ─────────────────────────────────────────────────────────────
def build_irs_url(result, email_text="", sender_email=""):
    first_line = email_text.strip().split('\n')[0][:80] if email_text else ""
    prefill = {
        "subject":     first_line or "Suspicious email detected by PhishScan",
        "sender":      sender_email or "",
        "flags":       result["reasons"],
        "threatLevel": "DANGEROUS" if result["score"] >= 70 else "SUSPICIOUS",
        "score":       result["score"],
        "timestamp":   ""
    }
    encoded = base64.urlsafe_b64encode(
        json.dumps(prefill).encode("utf-8")
    ).decode("utf-8")
    return f"{IRS_BASE_URL}?prefill={encoded}"

# ── Report Button ─────────────────────────────────────────────────────────────
def show_report_button(result, email_text="", sender_email=""):
    if result["score"] < 40:
        return
    irs_url = build_irs_url(result, email_text, sender_email)
    st.markdown("<br>", unsafe_allow_html=True)
    st.link_button(
        "🚨  Report This Incident to Project Zero Trust",
        url=irs_url,
        use_container_width=True,
        type="primary"
    )
    st.caption("Opens the Incident Reporting System with this scan pre-filled.")

# ── show_result ───────────────────────────────────────────────────────────────
def show_result(r, email_text="", sender_email=""):
    st.markdown("""
    <div class="results-wrap">
      <div class="results-header-bar">
        <span class="results-header-title">// Analysis Result</span>
        <span class="results-header-badge">PHISHSCAN AI</span>
      </div>
      <div class="results-body">
    """, unsafe_allow_html=True)

    st.markdown(f"""
    <div class="score-display"
         style="background:{r['color']}0d; border:1px solid {r['color']}33;">
      <div class="score-circle"
           style="border-color:{r['color']};
                  box-shadow: 0 0 24px {r['glow']}, inset 0 0 16px rgba(0,0,0,0.3);">
        <span class="score-num" style="color:{r['color']};">{r['score']}</span>
        <span class="score-of">/ 100</span>
      </div>
      <div class="score-meta">
        <div class="score-verdict" style="color:{r['color']};">{r['verdict']}</div>
        <div class="score-confidence">AI Confidence: <span>{r['confidence']}%</span></div>
        <div class="progress-track">
          <div class="progress-fill" style="width:{r['score']}%;"></div>
        </div>
      </div>
    </div>
    <div class="reasons-title">Detection Reasons</div>
    """, unsafe_allow_html=True)

    css_cls = "safe" if r['score'] < 40 else ""
    for reason in r['reasons']:
        st.markdown(
            f'<div class="reason-item {css_cls}">{reason}</div>',
            unsafe_allow_html=True
        )

    st.markdown("</div></div>", unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)
    if r['score'] >= 70:
        st.error("⛔ **Do NOT click any links or reply to this email.** "
                 "Report it to your email provider and delete it immediately.")
    elif r['score'] >= 40:
        st.warning("⚠️ **Treat this email with caution.** "
                   "Verify the sender through official channels before taking any action.")
    else:
        st.success("✅ **This email appears safe.** "
                   "Always stay vigilant — no detector is 100% accurate.")

    show_report_button(r, email_text, sender_email)


# ══════════════════════════════════════════════════════════
#  HERO SECTION
# ══════════════════════════════════════════════════════════
st.markdown("""
<div class="hero-wrap">
  <div class="hero-eyebrow">AI Threat Intelligence Platform</div>
  <h1 class="hero-title">PhishScan AI</h1>
  <p class="hero-subtitle">
    Detect phishing emails instantly using <strong>DistilBERT</strong> +
    <strong>LIME explainability</strong> + <strong>rule-based heuristics</strong>.
    Paste email text or upload a screenshot for instant analysis.
  </p>
  <div class="stats-row">
    <div class="stat-pill">
      <span class="stat-val">98.6%</span>
      <span class="stat-lbl">Accuracy</span>
    </div>
    <div class="stat-pill">
      <span class="stat-val">&lt; 2s</span>
      <span class="stat-lbl">Scan Time</span>
    </div>
    <div class="stat-pill">
      <span class="stat-val">3-Layer</span>
      <span class="stat-lbl">Analysis</span>
    </div>
  </div>
</div>
<div class="grad-line"></div>
""", unsafe_allow_html=True)


# ══════════════════════════════════════════════════════════
#  TABS
# ══════════════════════════════════════════════════════════
tab1, tab2 = st.tabs(["  📝  Paste Email Text  ", "  🖼️  Upload Screenshot  "])

# ════════════════════════════════
#  TAB 1 — Paste Text
# ════════════════════════════════
with tab1:
    st.markdown('<div class="input-card">', unsafe_allow_html=True)
    st.markdown('<div class="card-label">Input Email Data</div>', unsafe_allow_html=True)

    col_body, col_ctrl = st.columns([2.3, 1])

    with col_body:
        email_text_input = st.text_area(
            "Email Body",
            height=230,
            placeholder="Paste the full email content here…",
            key="email_body_input"
        )

    with col_ctrl:
        sender_text = st.text_input(
            "Sender Address",
            placeholder="support@paypa1.com",
            key="sender_text"
        )
        st.markdown("<br>", unsafe_allow_html=True)
        scan_text_btn = st.button(
            "⚡  Scan Email",
            type="primary",
            use_container_width=True,
            key="scan_text_btn"
        )
        st.markdown("<br>", unsafe_allow_html=True)
        if st.button(
            "◈  Load Example",
            use_container_width=True,
            key="example_btn"
        ):
            st.session_state["load_example"] = True

    st.markdown('</div>', unsafe_allow_html=True)

    if st.session_state.get("load_example"):
        email_text_input = (
            "Dear Customer, your PayPal account has been suspended. "
            "Verify immediately or it will be permanently closed. "
            "Click here to login: http://paypa1-secure.com/verify"
        )
        sender_text = "support@paypa1.com"
        st.session_state["load_example"] = False

    if scan_text_btn:
        if email_text_input.strip():
            with st.spinner("Running threat analysis…"):
                result = phishscan_predict(email_text_input, sender_text)
            show_result(result, email_text_input, sender_text)
        else:
            st.warning("Please paste an email body to scan.")

# ════════════════════════════════
#  TAB 2 — Upload Image
# ════════════════════════════════
with tab2:
    st.markdown('<div class="input-card">', unsafe_allow_html=True)
    st.markdown('<div class="card-label">Upload Email Screenshot</div>', unsafe_allow_html=True)

    st.markdown("""
    <div class="upload-hint">
      ▸ Supported formats: <span>PNG &nbsp;·&nbsp; JPG &nbsp;·&nbsp; JPEG &nbsp;·&nbsp; WEBP</span><br>
      ▸ OCR engine extracts visible text automatically<br>
      ▸ Use high-resolution screenshots for best accuracy
    </div>
    """, unsafe_allow_html=True)

    uploaded_file = st.file_uploader(
        "Drop screenshot here or click to browse",
        type=["png", "jpg", "jpeg", "webp"],
        label_visibility="visible"
    )

    if uploaded_file is not None:
        image = Image.open(uploaded_file)
        st.image(image, caption="Uploaded email screenshot", use_column_width=True)

        st.markdown("<br>", unsafe_allow_html=True)
        col_s, col_b = st.columns([2.3, 1])

        with col_s:
            sender_img = st.text_input(
                "Sender Address",
                placeholder="support@paypa1.com",
                key="sender_img"
            )

        with col_b:
            st.markdown("<br>", unsafe_allow_html=True)
            scan_image_btn = st.button(
                "⚡  Scan Screenshot",
                type="primary",
                use_container_width=True,
                key="scan_image_btn"
            )

        st.markdown('</div>', unsafe_allow_html=True)

        if scan_image_btn:
            with st.spinner("Extracting text via OCR…"):
                img_array      = np.array(image)
                ocr_results    = ocr_reader.readtext(img_array)
                extracted_text = " ".join([
                    text for (_, text, conf) in ocr_results if conf > 0.3
                ])

            if extracted_text.strip():
                st.markdown(
                    '<div class="card-label" style="margin-top:1.2rem;">Extracted Text</div>',
                    unsafe_allow_html=True
                )
                st.markdown(
                    f'<div class="ocr-box">{extracted_text}</div>',
                    unsafe_allow_html=True
                )
                with st.spinner("Analyzing with AI threat engine…"):
                    result = phishscan_predict(extracted_text, sender_img)
                show_result(result, extracted_text, sender_img)
            else:
                st.error("❌ Could not extract text from this image. Please try a clearer screenshot.")
                st.info("💡 Tips: Use a high-resolution screenshot, ensure text is clearly visible, avoid blurry or dark images.")
    else:
        st.markdown('</div>', unsafe_allow_html=True)

# ── Footer ────────────────────────────────────────────────────────────────────
st.markdown("""
<div class="footer-wrap">
  <div class="footer-inner">
    <span>Project Zero Trust</span>
    <span class="footer-dot"></span>
    <span class="footer-brand">PhishScan AI</span>
    <span class="footer-dot"></span>
    <span>DistilBERT</span>
    <span class="footer-dot"></span>
    <span>LIME</span>
    <span class="footer-dot"></span>
    <span>EasyOCR</span>
  </div>
</div>
""", unsafe_allow_html=True)