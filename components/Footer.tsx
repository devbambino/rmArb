// components/Footer.tsx
import Link from 'next/link';

// Simple SVG Icon components for clarity
const FacebookIcon = () => (
  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
  </svg>
);

const InstagramIcon = () => (
    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.85s-.011 3.584-.069 4.85c-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.069-4.85.069s-3.585-.011-4.85-.069c-3.252-.149-4.771-1.664-4.919-4.919-.058-1.265-.069-1.645-.069-4.85 0-3.204.012-3.584.069-4.85.149-3.225 1.664-4.771 4.919-4.919C8.415 2.175 8.796 2.163 12 2.163zm0 1.626c-3.141 0-3.506.012-4.73.069-2.693.123-3.999 1.433-4.122 4.122-.058 1.224-.069 1.588-.069 4.73s.011 3.506.069 4.73c.123 2.689 1.429 3.999 4.122 4.122 1.224.058 1.588.069 4.73.069s3.506-.011 4.73-.069c2.693-.123 3.999-1.433 4.122-4.122.058-1.224.069-1.588.069-4.73s-.011-3.506-.069-4.73c-.123-2.689-1.429-3.999-4.122-4.122-1.224-.058-1.588-.069-4.73-.069z" />
        <path d="M12 6.874c-2.835 0-5.126 2.291-5.126 5.126s2.291 5.126 5.126 5.126 5.126-2.291 5.126-5.126-2.291-5.126-5.126-5.126zm0 8.627c-1.932 0-3.501-1.569-3.501-3.501s1.569-3.501 3.501-3.501 3.501 1.569 3.501 3.501-1.569 3.501-3.501 3.501z" />
        <path d="M16.965 6.57c-.552 0-1 .448-1 1s.448 1 1 1 1-.448 1-1-.448-1-1-1z" />
    </svg>
);

const TwitterIcon = () => (
    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
);

const LinkedInIcon = () => (
    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.25 6.5 1.75 1.75 0 016.5 8.25zM19 19h-3v-4.74c0-1.42-.6-2.13-1.5-2.13S13 13 13 14.26V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.56 0 3.4 1.22 3.4 3.96z" />
    </svg>
);


export default function Footer() {
  const socialLinks = [
    { href: "https://www.facebook.com/rapimoniapp", icon: FacebookIcon, label: "Facebook" },
    { href: "https://www.instagram.com/rapimoniapp/", icon: InstagramIcon, label: "Instagram" },
    { href: "https://x.com/rapimoniapp", icon: TwitterIcon, label: "Twitter" },
    { href: "https://www.linkedin.com/company/rapimoni/", icon: LinkedInIcon, label: "LinkedIn" },
  ];

  return (
    <footer className="bg-primary/80 text-neutral py-8 mt-16">
      <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center">
        <div className="mb-4 sm:mb-0">
         <p>© {new Date().getFullYear()} RapiMoni. All rights reserved.</p>
        </div>
        <div className="flex items-center space-x-6 mb-4 sm:mb-0">
          <Link href="/terms" className="hover:underline text-sm">Terms</Link>
          <Link href="/privacy" className="hover:underline text-sm">Privacy</Link>
          <Link href="/contact" className="hover:underline text-sm">Contact</Link>
        </div>
        <div className="flex items-center space-x-4">
          {socialLinks.map(link => (
            <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" aria-label={link.label} className="text-neutral hover:text-secondary transition-colors">
              <link.icon />
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}