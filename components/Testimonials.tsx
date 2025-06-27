// components/Testimonials.tsx
import Image, { StaticImageData } from 'next/image';
import { CircleUserRoundIcon } from "lucide-react";

interface Testimonial {
  quote: string;
  name: string;
  title: string;
  avatar: StaticImageData | string;
}

interface TestimonialsProps {
  testimonials: Testimonial[];
  title: string;
}

export function Testimonials({ testimonials, title }: TestimonialsProps) {
  return (
    <section className="bg-primary/80 py-20 px-4">
      <div className="max-w-6xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-12">{title}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="bg-primary p-6 rounded-lg text-left">
              <p className="text-neutral mb-6 text-lg italic">"{testimonial.quote}"</p>
              <div className="flex items-center">
                <CircleUserRoundIcon className="h-10 w-10 mr-4" />
                <div>
                  <p className="font-bold text-white">{testimonial.name}</p>
                  <p className="text-sm text-secondary">{testimonial.title}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}