import Link from "next/link";

export default function NotFound() {
  return (
    <section className="section" style={{ paddingTop: 170, minHeight: "65vh" }}>
      <div className="container">
        <p className="eyebrow">PAGE NOT FOUND</p>
        <h1 style={{ fontSize: 46, marginBottom: 22 }}>
          Let’s find your way back.
        </h1>
        <p style={{ marginBottom: 30 }}>
          This page is not part of the current RedDev preview.
        </p>
        <Link href="/" className="button button-primary">
          Return to the homepage
        </Link>
      </div>
    </section>
  );
}
