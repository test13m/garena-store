
'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel';
import Autoplay from 'embla-carousel-autoplay';
import { cn } from '@/lib/utils';
import type { SliderImage } from '@/lib/definitions';
import { getSliderImages } from '@/app/admin/(protected)/slider-management/actions';
import { Skeleton } from './ui/skeleton';

export default function ImageSlider() {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [sliderImages, setSliderImages] = useState<SliderImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchImages() {
      try {
        const images = await getSliderImages();
        setSliderImages(images);
      } catch (error) {
        console.error("Failed to fetch slider images:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchImages();
  }, []);

  useEffect(() => {
    if (!api) {
      return;
    }

    setCurrent(api.selectedScrollSnap());

    const onSelect = () => {
      setCurrent(api.selectedScrollSnap());
    };

    api.on('select', onSelect);

    return () => {
      api.off('select', onSelect);
    };
  }, [api]);

  const scrollTo = useCallback((index: number) => {
    api?.scrollTo(index);
  }, [api]);
  
  if (isLoading) {
      return (
         <section className="w-full py-6 md:py-8">
            <div className="container mx-auto px-4 md:px-6">
                <Skeleton className="relative h-[180px] md:h-[220px] lg:h-[250px] w-full rounded-lg" />
            </div>
        </section>
      )
  }
  
  if (sliderImages.length === 0) {
      return null; // Don't render anything if there are no images
  }


  return (
    <section className="w-full py-6 md:py-8">
      <div className="container mx-auto px-4 md:px-6">
        <Carousel
          setApi={setApi}
          className="w-full group"
          plugins={[
            Autoplay({
              delay: 5000,
            }),
          ]}
          opts={{
            loop: true,
          }}
        >
          <CarouselContent>
            {sliderImages.map((image, index) => (
              <CarouselItem key={image._id.toString()}>
                <div className="relative h-[180px] md:h-[220px] lg:h-[250px] w-full overflow-hidden rounded-lg">
                  <Image
                    src={image.imageUrl}
                    alt={`Slider image ${index + 1}`}
                    fill
                    className="object-cover"
                    priority={index === 0}
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black/20 hover:bg-black/40 border-none hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity" />
          <CarouselNext className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black/20 hover:bg-black/40 border-none hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {sliderImages.map((_, index) => (
              <button
                key={index}
                onClick={() => scrollTo(index)}
                className={cn(
                  'h-2 w-2 rounded-full transition-colors',
                  current === index ? 'bg-primary' : 'bg-white/50'
                )}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </Carousel>
      </div>
    </section>
  );
}
