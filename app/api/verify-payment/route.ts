import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const uid = await verifyToken(req);
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { paymentId, deckId } = await req.json();
    if (!paymentId || !deckId) {
      return NextResponse.json({ error: "paymentId and deckId are required." }, { status: 400 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    // Fallback if Razorpay keys are not configured in environment
    if (!keyId || !keySecret) {
      console.warn("Razorpay keys not configured; bypassing verification for dev mode.");
      await writePaidStatus(uid, deckId, paymentId, req);
      return NextResponse.json({ success: true, devMode: true });
    }

    // Call Razorpay API to check payment status
    const authString = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const rzpRes = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Basic ${authString}`,
      },
    });

    if (!rzpRes.ok) {
      console.error("Razorpay API error:", await rzpRes.text());
      return NextResponse.json({ error: "Invalid payment ID or Razorpay verification failed." }, { status: 400 });
    }

    const payment = await rzpRes.json();
    if (payment.status !== "captured") {
      return NextResponse.json({ error: `Payment status is ${payment.status}, expected captured.` }, { status: 400 });
    }

    // Payment verified! Update database paid flag
    await writePaidStatus(uid, deckId, paymentId, req);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[/api/verify-payment] error:", err);
    return NextResponse.json({ error: err?.message || "Payment verification failed." }, { status: 500 });
  }
}

async function writePaidStatus(uid: string, deckId: string, paymentId: string, req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : "";
  if (!idToken || idToken.startsWith("local_")) {
    return;
  }
  const dbUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL?.replace(/\/$/, "");
  const payload = {
    paid: {
      paidAt: Date.now(),
      method: "razorpay-redirect",
      paymentId: paymentId
    }
  };
  const dbRes = await fetch(`${dbUrl}/decks/${uid}/${deckId}.json?auth=${idToken}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!dbRes.ok) {
    throw new Error(`Failed to update database: ${await dbRes.text()}`);
  }
}
