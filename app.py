# app.py — Run with: streamlit run app.py
import os
import streamlit as st
import torch
import numpy as np
import Levenshtein
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from lime.lime_text import LimeTextExplainer

# ── Page Config ──
st.set_page_config(
    page_title="PhishScan AI — Email Threat Detector",
    page_icon="🎣",
    layout="centered"
)

# ── Custom CSS ──
st.markdown("""
<style>
  .main { background-color: #080c14; }
  .block-container { padding-top: 2rem; max-width: 780px; }
  .score-box {
    text-align: center; padding: 28px;
    border-radius: 14px; margin: 16px 0;
  }
  .score-num  { font-size: 64px; font-weight: 900; line-height: 1; }
  .score-lbl  { font-size: 12px; color: #5a7a9a; margin-bottom: 6px; }
  .verdict    { font-size: 20px; font-weight: 700; margin-top: 6px; }
  .conf-lbl   { font-size: 13px; color: #8ab4d4; margin-top: 4px; }
  .reason-box {
    background: #111d2e; border: 1px solid #1a2840;
    border-radius: 8px; padding: 12px 16px;
    margin-bottom: 8px; font-size: 14px; color: #c8d8f0;
  }
  .reason-box::before { content: ">> "; color: #ff3e5a; font-weight: 700; }
  .safe-box   { background: #0a1f14; border: 1px solid #00e5a055; }
  .safe-box::before { content: ">> "; color: #00e5a0; font-weight: 700; }
  h1 { color: #ffffff !important; }
  .stTextArea textarea { background: #0d1422 !important; color: #e2eeff !important; }
  .stTextInput input   { background: #0d1422 !important; color: #e2eeff !important; }
</style>
""", unsafe_allow_html=True)

# ── Load Model (cached) ──
@st.cache_resource
def load_model():
    model_path = "D:/CyberDefenseHubwebsite/models/phishscan_final_model"
    
    tok = AutoTokenizer.from_pretrained(model_path, local_files_only=True)
    mdl = AutoModelForSequenceClassification.from_pretrained(model_path, local_files_only=True)
    mdl.eval()
    return tok, mdl

tokenizer, model = load_model()
explainer = LimeTextExplainer(class_names=["Safe", "Phishing"])

# ── Helper Functions ──
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
        reasons.append(f"Urgency triggers: {', '.join(found_u)}")
        score += 30
    found_f = [w for w in FINANCIAL if w in t]
    if found_f:
        reasons.append(f"Financial lure: {', '.join(found_f)}")
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
        verdict, color = "HIGH RISK — LIKELY PHISHING", "#ff3e5a"
    elif final_score >= 40:
        verdict, color = "MEDIUM RISK — SUSPICIOUS", "#ff8c00"
    else:
        verdict, color = "LOW RISK — LIKELY SAFE", "#00e5a0"
    return {
        "score": final_score, "verdict": verdict, "color": color,
        "confidence": round(bert_prob * 100, 1),
        "reasons": (rule_reasons + lime_reasons) or ["No specific threat indicators found."]
    }

# ══════════════════════════════════════════════
#  UI
# ══════════════════════════════════════════════
st.markdown("## 🎣 PhishScan AI")
st.markdown("**AI-Powered Email Threat Detector** — Paste a suspicious email and get an instant risk report.")
st.divider()

col1, col2 = st.columns([2, 1])
with col1:
    email_text = st.text_area(
        "📧 Email Body",
        height=220,
        placeholder="Paste the full email content here..."
    )
with col2:
    sender = st.text_input(
        "📨 Sender Email (optional)",
        placeholder="e.g. support@paypa1.com"
    )
    st.markdown("<br>", unsafe_allow_html=True)
    scan = st.button("🔍 Scan Email", type="primary", use_container_width=True)
    st.markdown("<br>", unsafe_allow_html=True)
    # Quick example button
    if st.button("⚡ Load Example", use_container_width=True):
        st.session_state["example"] = True

# Load example
if st.session_state.get("example"):
    email_text = "Dear Customer, your PayPal account has been suspended. Verify immediately or it will be permanently closed. Click here to login: http://paypa1-secure.com/verify"
    sender = "support@paypa1.com"
    st.session_state["example"] = False

# ── Scan Result ──
if scan and email_text.strip():
    with st.spinner("Scanning with AI..."):
        r = phishscan_predict(email_text, sender)

    # Score display
    st.markdown(f"""
    <div class="score-box" style="background: {r['color']}15;
         border: 1px solid {r['color']}44;">
      <div class="score-lbl">RISK SCORE</div>
      <div class="score-num" style="color:{r['color']}">{r['score']}</div>
      <div class="score-lbl">out of 100</div>
      <div class="verdict"  style="color:{r['color']}">{r['verdict']}</div>
      <div class="conf-lbl">AI Confidence: {r['confidence']}%</div>
    </div>""", unsafe_allow_html=True)

    # Risk bar
    st.progress(r['score'] / 100)

    # Reasons
    st.markdown("#### 🚩 Detection Reasons")
    is_safe = r['score'] < 40
    css_cls  = "safe-box" if is_safe else "reason-box"
    for reason in r['reasons']:
        st.markdown(
            f'<div class="reason-box {css_cls}">{reason}</div>',
            unsafe_allow_html=True
        )

    # Advice
    st.divider()
    if r['score'] >= 70:
        st.error("⛔ **Do NOT click any links or reply to this email.** Report it to your email provider and delete it immediately.")
    elif r['score'] >= 40:
        st.warning("⚠️ **Treat this email with caution.** Verify the sender through official channels before taking any action.")
    else:
        st.success("✅ **This email appears safe.** Always stay vigilant — no detector is 100% accurate.")

elif scan:
    st.warning("Please paste an email body to scan.")

# Footer
st.divider()
st.markdown(
    "<div style='text-align:center; font-size:12px; color:#2a3a55;'>"
    "PhishScan AI — Cyber Defense Hub · Powered by DistilBERT + LIME"
    "</div>", unsafe_allow_html=True
)