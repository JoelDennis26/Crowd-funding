import { useEffect, useRef } from 'react';

function About() {
  const sectionRefs = useRef([]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('show');
        }
      });
    }, { threshold: 0.1 });

    sectionRefs.current.forEach(section => {
      if (section) observer.observe(section);
    });

    return () => {
      sectionRefs.current.forEach(section => {
        if (section) observer.unobserve(section);
      });
    };
  }, []);

  const addToRefs = (el) => {
    if (el && !sectionRefs.current.includes(el)) {
      sectionRefs.current.push(el);
    }
  };

  return (
    <>
      <div className="section" id="about1" ref={addToRefs}>
          <h1>About Us</h1>
      </div>

      <div className="section" ref={addToRefs}>
          <h2>The Problem We're Addressing</h2>
          <p>Every day, millions of people have incredible ideas, urgent needs, and life-changing initiatives—but lack the financial support to bring them to life. Whether it’s funding creative projects, supporting environmental causes, or helping a community in crisis, access to funding remains a major hurdle.</p>
      </div>

      <div className="section" ref={addToRefs}>
          <h2>Why It Needs to Be Solved</h2>
          <p>Traditional funding methods are often slow, exclusive, and filled with barriers. Banks require collateral, grants take months, and venture capital is selective. Crowdfunding offers an alternative—one that empowers individuals, small businesses, and nonprofit initiatives by allowing communities to contribute directly to causes they care about.</p>
      </div>

      <div className="section" ref={addToRefs}>
          <h2>How We Plan on Solving It</h2>
          <p>FundHive is a crowdfunding platform built with transparency, security, and accessibility in mind. We provide:</p>
          <ul>
              <li>A seamless platform where anyone can create and support fundraisers.</li>
              <li>Secure transactions to ensure funds go exactly where they're needed.</li>
              <li>A strong community that believes in making a difference together.</li>
          </ul>
          <p>We are a company that operates with honesty and integrity—our goal is not to steal money, but to create a space where anyone can fund their dreams or support causes they believe in. Every transaction is recorded, and we are working on implementing strict fraud prevention measures.</p>
      </div>

      <div className="section mission" ref={addToRefs}>
          <h2>Our Mission Statement</h2>
          <p>"Empowering change by connecting people with the causes that matter most. Together, we can turn ideas into impact and challenges into opportunities."</p>
      </div>
    </>
  );
}

export default About;
