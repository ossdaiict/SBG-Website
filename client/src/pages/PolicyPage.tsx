import { motion } from 'framer-motion';
import { Clock, FileText, ShieldAlert, Users } from 'lucide-react';
import React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { CLUBS } from '../constants';

const PolicyPage: React.FC = () => {
  const getClubsByGroup = (group: 'A' | 'B' | 'C') => CLUBS.filter(c => c.group === group);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="max-w-4xl mx-auto space-y-6 sm:space-y-8 w-full px-1"
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="text-center pb-6 sm:pb-8 border-b border-borderSoft"
      >
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-foreground tracking-tighter">Slot Booking Policy</h1>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base font-medium max-w-lg mx-auto">Guidelines for venue reservation and campus event conduct</p>
      </motion.div>

      <Accordion type="single" collapsible defaultValue="item-0" className="space-y-3 sm:space-y-4">my
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <AccordionItem value="item-0" className="border border-borderSoft rounded-lg bg-card shadow-sm overflow-hidden">
            <AccordionTrigger className="px-5 py-4 hover:no-underline">
              <div className="flex items-center gap-3">
                <Clock className="text-primary" size={20} />
                <span className="font-semibold text-foreground">Timeline & Booking Windows</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5 pt-0">
              <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
                <li><strong>Co-curricular Events:</strong> Must be booked at least <span className="text-error font-bold">14 days</span> in advance.</li>
                <li><strong>Open-for-All Events:</strong> Must be booked at least <span className="text-error font-bold">20 days</span> in advance.</li>
                <li><strong>Closed Club Events:</strong> Can be booked up to <span className="text-error font-bold">1 day</span> before the event date.</li>
                <li>Requests made outside these windows will be automatically flagged for rejection unless a special waiver is granted by the SBG.</li>
              </ul>
            </AccordionContent>
          </AccordionItem>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <AccordionItem value="item-1" className="border border-borderSoft rounded-lg bg-card shadow-sm overflow-hidden">
            <AccordionTrigger className="px-5 py-4 hover:no-underline">
              <div className="flex items-center gap-3">
                <ShieldAlert className="text-primary" size={20} />
                <span className="font-semibold text-foreground">Parallel Booking Policy</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5 pt-0">
              <p className="mb-3 text-sm text-muted-foreground">To ensure maximum student participation and avoid conflict of interests, the following parallel booking rules apply:</p>
              <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
                <li>Two clubs from the <strong className="text-foreground">same group</strong> (e.g., Group A and Group A) cannot hold major events simultaneously.</li>
                <li>Parallel events are <strong className="text-foreground">permitted</strong> if the clubs belong to <strong className="text-foreground">different groups</strong> (e.g., Group A and Group C).</li>
                <li>Exceptions are made for Closed Club events (internal meetings) which do not require mass student participation.</li>
              </ul>
            </AccordionContent>
          </AccordionItem>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <AccordionItem value="item-2" className="border border-borderSoft rounded-lg bg-card shadow-sm overflow-hidden">
            <AccordionTrigger className="px-5 py-4 hover:no-underline">
              <div className="flex items-center gap-3">
                <FileText className="text-primary" size={20} />
                <span className="font-semibold text-foreground">Venue Categories & Approval</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5 pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <Card className="border border-border">
                  <CardHeader>
                    <CardTitle className="text-base">Category A (Auto-Approval)</CardTitle>
                    <CardDescription className="text-xs">CEP 103, CEP 104, CEP 105, CEP 106, CEP 107, CEP 202, CEP 203, CEP 205, OAT, Cafeteria Entrance</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">Bookings are automatically confirmed if the slot is vacant and timeline rules are met. No manual intervention required.</p>
                  </CardContent>
                </Card>
                <Card className="border border-border">
                  <CardHeader>
                    <CardTitle className="text-base">Category B (Restricted)</CardTitle>
                    <CardDescription className="text-xs">Lecture Theatres (LT), CEP 102, CEP 110, SAC Ground</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">Always requires manual approval from the SBG Deputy Convener. Pending status applies until approved.</p>
                  </CardContent>
                </Card>
              </div>
            </AccordionContent>
          </AccordionItem>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <AccordionItem value="item-3" className="border border-borderSoft rounded-lg bg-card shadow-sm overflow-hidden">
            <AccordionTrigger className="px-5 py-4 hover:no-underline">
              <div className="flex items-center gap-3">
                <Users className="text-primary" size={20} />
                <span className="font-semibold text-foreground">Club Groups Appendix</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5 pt-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mt-2">
                <div>
                  <h4 className="font-bold text-brand mb-2 border-b border-brand/30 pb-1">Group A (Tech)</h4>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {getClubsByGroup('A').map(c => <li key={c.name}>{c.name}</li>)}
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold text-brand-link mb-2 border-b border-brand-link/30 pb-1">Group B (Cultural)</h4>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {getClubsByGroup('B').map(c => <li key={c.name}>{c.name}</li>)}
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold text-brand mb-2 border-b border-brand/30 pb-1">Group C (Sports)</h4>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {getClubsByGroup('C').map(c => <li key={c.name}>{c.name}</li>)}
                  </ul>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </motion.div>
      </Accordion>
    </motion.div>
  );
};

export default PolicyPage;