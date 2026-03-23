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
    page_icon="🎣",
    layout="centered"
)

# ── IRS URL ──────────────────────────────────────────────────────────────────
# Your IRS runs locally via Live Server.
# Update the port if yours is different from 5500.
IRS_BASE_URL = "https://yashveer483.github.io/Incident-Reporting/index.html"
# ─────────────────────────────────────────────────────────────────────────────

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
  .ocr-box {
    background: #0d1a2e; border: 1px solid #1e3a5a;
    border-radius: 8px; padding: 14px 16px;
    font-size: 13px; color: #8ab4d4;
    margin: 10px 0; max-height: 160px; overflow-y: auto;
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


# ── Build IRS URL with Base64-encoded prefill param ──────────────────────────
def build_irs_url(result, email_text="", sender_email=""):
    """
    Encodes the scan data as Base64 JSON and appends it as a URL parameter.
    The IRS reads ?prefill= on page load via integration.js.

    Example output:
    https://yashveer483.github.io/Incident-Reporting/index.html?prefill=eyJzdWJqZWN0Ij...
    """
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


# ── Report Button — uses st.link_button (always visible, no iframe issues) ───
def show_report_button(result, email_text="", sender_email=""):
    """
    Renders the Report This Incident button for score >= 40.
    Uses st.link_button so it opens the IRS directly as a hyperlink —
    no JS, no localStorage, no cross-origin issues.
    """
    if result["score"] < 40:
        return

    irs_url = build_irs_url(result, email_text, sender_email)

    st.markdown("---")

    # st.link_button opens the URL in the same tab
    st.link_button(
        "🚨 Report This Incident to Project Zero Trust",
        url=irs_url,
        use_container_width=True,
        type="primary"
    )
    st.caption(
        "Opens the Incident Reporting System with this scan pre-filled. "
        "Make sure your IRS page is running on Live Server first."
    )


# ── show_result ───────────────────────────────────────────────────────────────
def show_result(r, email_text="", sender_email=""):
    st.markdown(f"""
    <div class="score-box" style="background: {r['color']}15;
         border: 1px solid {r['color']}44;">
      <div class="score-lbl">RISK SCORE</div>
      <div class="score-num" style="color:{r['color']}">{r['score']}</div>
      <div class="score-lbl">out of 100</div>
      <div class="verdict" style="color:{r['color']}">{r['verdict']}</div>
      <div class="conf-lbl">AI Confidence: {r['confidence']}%</div>
    </div>""", unsafe_allow_html=True)

    st.progress(r['score'] / 100)

    st.markdown("#### 🚩 Detection Reasons")
    css_cls = "safe-box" if r['score'] < 40 else "reason-box"
    for reason in r['reasons']:
        st.markdown(f'<div class="reason-box {css_cls}">{reason}</div>',
                    unsafe_allow_html=True)
    st.divider()

    if r['score'] >= 70:
        st.error("⛔ **Do NOT click any links or reply to this email.** "
                 "Report it to your email provider and delete it immediately.")
    elif r['score'] >= 40:
        st.warning("⚠️ **Treat this email with caution.** "
                   "Verify the sender through official channels before taking any action.")
    else:
        st.success("✅ **This email appears safe.** "
                   "Always stay vigilant — no detector is 100% accurate.")

    # Show Report button for suspicious / dangerous results
    show_report_button(r, email_text, sender_email)


# ══════════════════════════════════════════════
#  UI
# ══════════════════════════════════════════════
st.markdown("## 🎣 PhishScan AI")
st.markdown("**AI-Powered Email Threat Detector** — Paste email text or upload a screenshot.")
st.divider()

tab1, tab2 = st.tabs(["📝 Paste Email Text", "🖼️ Upload Email Screenshot"])

# ════════════════════════════════
#  TAB 1 — Paste Text
# ════════════════════════════════
with tab1:
    col1, col2 = st.columns([2, 1])

    with col1:
        email_text_input = st.text_area(
            "📧 Email Body",
            height=220,
            placeholder="Paste the full email content here..."
        )
    with col2:
        sender_text = st.text_input(
            "📨 Sender Email (optional)",
            placeholder="e.g. support@paypa1.com",
            key="sender_text"
        )
        st.markdown("<br>", unsafe_allow_html=True)
        scan_text_btn = st.button(
            "🔍 Scan Email",
            type="primary",
            use_container_width=True,
            key="scan_text_btn"
        )
        st.markdown("<br>", unsafe_allow_html=True)
        if st.button("⚡ Load Example", use_container_width=True, key="example_btn"):
            st.session_state["load_example"] = True

    if st.session_state.get("load_example"):
        email_text_input = ("Dear Customer, your PayPal account has been suspended. "
                            "Verify immediately or it will be permanently closed. "
                            "Click here to login: http://paypa1-secure.com/verify")
        sender_text = "support@paypa1.com"
        st.session_state["load_example"] = False

    if scan_text_btn:
        if email_text_input.strip():
            with st.spinner("Scanning with AI..."):
                result = phishscan_predict(email_text_input, sender_text)
            show_result(result, email_text_input, sender_text)
        else:
            st.warning("Please paste an email body to scan.")

# ════════════════════════════════
#  TAB 2 — Upload Image
# ════════════════════════════════
with tab2:
    st.markdown("Upload a **screenshot** of a suspicious email — "
                "the AI will read the text and analyze it automatically.")
    st.markdown("")

    uploaded_file = st.file_uploader(
        "📎 Upload Email Screenshot",
        type=["png", "jpg", "jpeg", "webp"],
        help="Supported: PNG, JPG, JPEG, WEBP"
    )

    if uploaded_file is not None:
        image = Image.open(uploaded_file)
        st.image(image, caption="Uploaded email screenshot", use_column_width=True)

        col1, col2 = st.columns([2, 1])
        with col1:
            sender_img = st.text_input(
                "📨 Sender Email (optional)",
                placeholder="e.g. support@paypa1.com",
                key="sender_img"
            )
        with col2:
            st.markdown("<br>", unsafe_allow_html=True)
            scan_image_btn = st.button(
                "🔍 Scan Screenshot",
                type="primary",
                use_container_width=True,
                key="scan_image_btn"
            )

        if scan_image_btn:
            with st.spinner("Reading text from image with OCR..."):
                img_array      = np.array(image)
                ocr_results    = ocr_reader.readtext(img_array)
                extracted_text = " ".join([
                    text for (_, text, confidence) in ocr_results
                    if confidence > 0.3
                ])

            if extracted_text.strip():
                st.markdown("#### 📄 Text Extracted from Image")
                st.markdown(
                    f'<div class="ocr-box">{extracted_text}</div>',
                    unsafe_allow_html=True
                )
                with st.spinner("Analyzing extracted text with AI..."):
                    result = phishscan_predict(extracted_text, sender_img)
                show_result(result, extracted_text, sender_img)
            else:
                st.error("❌ Could not extract text from this image. "
                         "Please try a clearer screenshot.")
                st.info("💡 Tips: Use a high-resolution screenshot, "
                        "ensure text is clearly visible, avoid blurry or dark images.")

# ── Footer ──
st.divider()
st.markdown(
    "<div style='text-align:center; font-size:12px; color:#2a3a55;'>"
    "Project Zero Trust presents PhishScan AI - "
    "Powered by DistilBERT · LIME · EasyOCR"
    "</div>",
    unsafe_allow_html=True
)